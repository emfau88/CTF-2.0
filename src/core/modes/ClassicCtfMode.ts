import type { ActorId, TeamId, WorldPosition } from "../actors";
import type { GameEvent } from "../events";
import {
  createFlagObjective,
  type Objective,
} from "../objectives";
import {
  awardScore,
  createScoreBoardState,
  type ScoreEntry,
} from "../scoring";
import {
  AssignedSpawnProvider,
  type SpawnProvider,
} from "../spawning";
import type {
  WorldMapData,
  WorldMapPresentationRect,
  WorldSnapshot,
  WorldState,
} from "../world";
import type { GameMode, ModeHudState } from "./gameMode";
import { createMatchState, type MatchResult } from "./matchState";

export interface ClassicCtfModeConfig {
  readonly durationMs: number;
  readonly captureLimit: number;
  readonly pickupRadius: number;
  readonly dropReturnMs: number;
  readonly initialScores: readonly ScoreEntry[];
}

export const V2_CLASSIC_CTF_CONFIG: ClassicCtfModeConfig = {
  durationMs: 180_000,
  captureLimit: 3,
  pickupRadius: 36,
  dropReturnMs: 5_000,
  initialScores: [
    { id: "blue", teamId: "blue", score: 0 },
    { id: "red", teamId: "red", score: 0 },
  ],
};

export class ClassicCtfMode implements GameMode {
  readonly id = "classic-ctf";
  readonly spawnProvider: SpawnProvider = new AssignedSpawnProvider();

  constructor(
    private readonly map: WorldMapData,
    private readonly config: ClassicCtfModeConfig = V2_CLASSIC_CTF_CONFIG,
  ) {}

  initialize(world: WorldState): readonly GameEvent[] {
    world.modeId = this.id;
    world.match = createMatchState(
      "classic-ctf-match-1",
      this.id,
      this.config.durationMs,
    );
    world.match.phase = "running";
    world.scoreBoard = createScoreBoardState(this.config.initialScores);
    world.objectives = [
      createFlagObjective({
        id: "red-flag",
        kind: "team-flag",
        position: centerOf(this.map.gameplay.redBase),
        teamId: "red",
      }),
      createFlagObjective({
        id: "blue-flag",
        kind: "team-flag",
        position: centerOf(this.map.gameplay.blueBase),
        teamId: "blue",
      }),
    ];
    return [this.matchStartedEvent(world)];
  }

  update(world: WorldState, deltaMs: number): readonly GameEvent[] {
    const match = world.match;
    if (!match || match.phase !== "running") {
      return [];
    }
    const ms = Math.max(0, deltaMs);
    match.elapsedMs = Math.min(match.durationMs, match.elapsedMs + ms);
    match.remainingMs = Math.max(0, match.durationMs - match.elapsedMs);
    if (match.remainingMs <= 0) {
      return this.endMatch(world, "time-limit");
    }

    const events: GameEvent[] = [];
    this.syncCarriedFlags(world, events);
    this.updateDroppedFlags(world, ms, events);
    for (const actor of world.actors) {
      if (actor.lifeState !== "active" || !actor.teamId) continue;
      const carriedFlag = flagCarriedBy(world, actor.id);
      if (carriedFlag) {
        if (pointInRect(actor.position, this.baseFor(actor.teamId))) {
          events.push(...this.captureFlag(world, carriedFlag, actor.id));
          if (world.match?.phase === "ended") break;
        }
        continue;
      }
      const ownDroppedFlag = world.objectives.find((objective) =>
        isTeamFlag(objective) &&
        objective.state.controllingTeamId === actor.teamId &&
        objective.state.status === "dropped"
      );
      if (
        ownDroppedFlag &&
        distance(actor.position, ownDroppedFlag.position) <
          this.config.pickupRadius
      ) {
        events.push(...this.resetFlag(
          world,
          ownDroppedFlag,
          "owner-return",
          actor.id,
          actor.teamId,
        ));
        continue;
      }
      const enemyFlag = world.objectives.find((objective) =>
        isTeamFlag(objective) &&
        objective.state.controllingTeamId !== actor.teamId &&
        (objective.state.status === "home" ||
          objective.state.status === "dropped")
      );
      if (
        enemyFlag &&
        distance(actor.position, enemyFlag.position) < this.config.pickupRadius
      ) {
        replaceObjective(world, enemyFlag.id, {
          ...enemyFlag,
          state: {
            ...enemyFlag.state,
            status: "carried",
            interactingActorId: actor.id,
            returnRemainingMs: undefined,
          },
        });
        events.push({
          id: `flag-picked-up-${enemyFlag.id}-${actor.id}-${world.timeMs}`,
          type: "objective.flagPickedUp",
          timeMs: world.timeMs,
          sourceActorId: actor.id,
          teamId: actor.teamId,
          payload: {
            objectiveId: enemyFlag.id,
            flagTeamId: enemyFlag.state.controllingTeamId,
          },
        });
      }
    }
    return events;
  }

  handleEvent(event: GameEvent, world: WorldState): readonly GameEvent[] {
    if (
      event.type !== "actor.died" &&
      event.type !== "actor.fell"
    ) {
      return [];
    }
    const actorId = event.targetActorId ?? event.sourceActorId;
    const actor = world.actors.find((candidate) => candidate.id === actorId);
    return actor ? this.dropFlagsCarriedBy(world, actor, event.type) : [];
  }

  isComplete(world: WorldSnapshot): boolean {
    return world.match?.phase === "ended";
  }

  getHudState(world: WorldSnapshot): ModeHudState {
    return {
      modeId: this.id,
      phase: world.match?.phase ?? "notStarted",
      timeRemainingMs: world.match?.remainingMs,
      elapsedTimeMs: world.match?.elapsedMs,
      matchResult: world.match?.result ?? null,
      scores: world.scoreBoard.entries,
      objectives: world.objectives,
      notices: [`First to ${this.config.captureLimit} captures`],
    };
  }

  private syncCarriedFlags(
    world: WorldState,
    events: GameEvent[],
  ): void {
    for (const objective of [...world.objectives]) {
      if (!isTeamFlag(objective) || objective.state.status !== "carried") {
        continue;
      }
      const carrierId = objective.state.interactingActorId;
      const carrier = world.actors.find((actor) => actor.id === carrierId);
      if (!carrier) {
        events.push(...this.resetFlag(world, objective, "carrier-missing"));
        continue;
      }
      if (carrier.lifeState !== "active") {
        events.push(...this.dropFlag(
          world,
          objective,
          carrier,
          `carrier-${carrier.lifeState}`,
        ));
        continue;
      }
      replaceObjective(world, objective.id, {
        ...objective,
        position: {
          x: carrier.position.x,
          y: carrier.position.y - 24 - carrier.jump.height,
        },
      });
    }
  }

  private updateDroppedFlags(
    world: WorldState,
    deltaMs: number,
    events: GameEvent[],
  ): void {
    for (const objective of [...world.objectives]) {
      if (!isTeamFlag(objective) || objective.state.status !== "dropped") {
        continue;
      }
      const remainingMs = Math.max(
        0,
        (objective.state.returnRemainingMs ?? 0) - deltaMs,
      );
      if (remainingMs <= 0) {
        events.push(...this.resetFlag(world, objective, "drop-timeout"));
        continue;
      }
      replaceObjective(world, objective.id, {
        ...objective,
        state: {
          ...objective.state,
          returnRemainingMs: remainingMs,
        },
      });
    }
  }

  private captureFlag(
    world: WorldState,
    objective: Objective,
    actorId: ActorId,
  ): readonly GameEvent[] {
    const actor = world.actors.find((candidate) => candidate.id === actorId);
    if (!actor?.teamId) return [];
    const scoreEntry = world.scoreBoard.entries.find((entry) =>
      entry.teamId === actor.teamId
    );
    if (!scoreEntry) return [];
    const awardKey = `capture:${actor.teamId}:${world.timeMs}:${actor.lifeId}`;
    const award = awardScore(world.scoreBoard, scoreEntry.id, 1, awardKey);
    if (!award.awarded) return [];
    this.resetFlagToHome(world, objective);
    const events: GameEvent[] = [{
      id: `flag-captured-${objective.id}-${actor.id}-${world.timeMs}`,
      type: "objective.flagCaptured",
      timeMs: world.timeMs,
      sourceActorId: actor.id,
      teamId: actor.teamId,
      payload: {
        objectiveId: objective.id,
        flagTeamId: objective.state.controllingTeamId,
        score: award.score,
      },
    }, {
      id: `score-awarded-${awardKey}`,
      type: "score.awarded",
      timeMs: world.timeMs,
      sourceActorId: actor.id,
      teamId: actor.teamId,
      payload: {
        entryId: scoreEntry.id,
        amount: 1,
        score: award.score,
        reason: "capture",
        awardKey,
      },
    }];
    if (award.score >= this.config.captureLimit) {
      events.push(...this.endMatch(world, "capture-limit"));
    }
    return events;
  }

  private dropFlagsCarriedBy(
    world: WorldState,
    actor: WorldState["actors"][number],
    reason: string,
  ): readonly GameEvent[] {
    return world.objectives.flatMap((objective) =>
      isTeamFlag(objective) &&
        objective.state.interactingActorId === actor.id
        ? this.dropFlag(world, objective, actor, reason)
        : []
    );
  }

  private dropFlag(
    world: WorldState,
    objective: Objective,
    actor: WorldState["actors"][number],
    reason: string,
  ): readonly GameEvent[] {
    const position = reason === "actor.fell" || reason === "carrier-falling"
      ? actor.lastSafePosition
      : actor.position;
    replaceObjective(world, objective.id, {
      ...objective,
      position: { ...position },
      state: {
        ...objective.state,
        status: "dropped",
        interactingActorId: null,
        returnRemainingMs: this.config.dropReturnMs,
      },
    });
    return [{
      id: `flag-dropped-${objective.id}-${world.timeMs}`,
      type: "objective.flagDropped",
      timeMs: world.timeMs,
      sourceActorId: actor.id,
      teamId: actor.teamId ?? undefined,
      payload: {
        objectiveId: objective.id,
        flagTeamId: objective.state.controllingTeamId,
        position: { ...position },
        returnMs: this.config.dropReturnMs,
        reason,
      },
    }];
  }

  private resetFlag(
    world: WorldState,
    objective: Objective,
    reason: string,
    sourceActorId?: ActorId,
    teamId?: TeamId,
  ): readonly GameEvent[] {
    this.resetFlagToHome(world, objective);
    return [{
      id: `flag-reset-${objective.id}-${world.timeMs}`,
      type: "objective.flagReset",
      timeMs: world.timeMs,
      sourceActorId,
      teamId,
      payload: {
        objectiveId: objective.id,
        flagTeamId: objective.state.controllingTeamId,
        reason,
      },
    }];
  }

  private baseFor(teamId: TeamId): WorldMapPresentationRect {
    return teamId === "red"
      ? this.map.gameplay.redBase
      : this.map.gameplay.blueBase;
  }

  private resetFlagToHome(
    world: WorldState,
    objective: Objective,
  ): void {
    const teamId = objective.state.controllingTeamId;
    if (!teamId) return;
    replaceObjective(world, objective.id, {
      ...objective,
      position: centerOf(this.baseFor(teamId)),
      state: {
        ...objective.state,
        status: "home",
        interactingActorId: null,
        returnRemainingMs: undefined,
      },
    });
  }

  private endMatch(
    world: WorldState,
    reason: "capture-limit" | "time-limit",
  ): readonly GameEvent[] {
    const match = world.match;
    if (!match || match.phase === "ended") return [];
    match.phase = "ended";
    match.result = resolveResult(world);
    return [{
      id: `match-ended-${match.id}-${reason}`,
      type: "match.ended",
      timeMs: world.timeMs,
      payload: {
        matchId: match.id,
        reason,
        result: match.result,
        scores: world.scoreBoard.entries.map((entry) => ({ ...entry })),
      },
    }];
  }

  private matchStartedEvent(world: WorldState): GameEvent {
    const match = world.match;
    if (!match) throw new Error("Classic CTF match state must exist.");
    return {
      id: `match-started-${match.id}`,
      type: "match.started",
      timeMs: world.timeMs,
      payload: {
        matchId: match.id,
        modeId: this.id,
        durationMs: match.durationMs,
        captureLimit: this.config.captureLimit,
      },
    };
  }
}

function flagCarriedBy(
  world: WorldState,
  actorId: ActorId,
): Objective | undefined {
  return world.objectives.find((objective) =>
    isTeamFlag(objective) &&
    objective.state.status === "carried" &&
    objective.state.interactingActorId === actorId
  );
}

function isTeamFlag(objective: Readonly<Objective>): boolean {
  return objective.kind === "team-flag";
}

function replaceObjective(
  world: WorldState,
  objectiveId: string,
  replacement: Objective,
): void {
  const index = world.objectives.findIndex((objective) =>
    objective.id === objectiveId
  );
  if (index >= 0) world.objectives[index] = replacement;
}

function centerOf(rect: WorldMapPresentationRect): WorldPosition {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function pointInRect(
  point: WorldPosition,
  rect: WorldMapPresentationRect,
): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height;
}

function distance(a: WorldPosition, b: WorldPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolveResult(world: WorldState): MatchResult {
  const highest = Math.max(
    ...world.scoreBoard.entries.map((entry) => entry.score),
    0,
  );
  const leaders = world.scoreBoard.entries.filter((entry) =>
    entry.score === highest
  );
  return leaders.length === 1 && leaders[0]
    ? { kind: "winner", winnerEntryId: leaders[0].id }
    : { kind: "draw" };
}
