import type { ActorId, TeamId, WorldPosition } from "../actors";
import type { GameEvent } from "../events";
import { createFlagObjective, type Objective } from "../objectives";
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

export interface OneFlagModeConfig {
  readonly durationMs: number;
  readonly captureLimit: number;
  readonly pickupRadius: number;
  readonly initialScores: readonly ScoreEntry[];
}

export const V2_ONE_FLAG_CONFIG: OneFlagModeConfig = {
  durationMs: 180_000,
  captureLimit: 3,
  pickupRadius: 36,
  initialScores: [
    { id: "blue", teamId: "blue", score: 0 },
    { id: "red", teamId: "red", score: 0 },
  ],
};

export class OneFlagMode implements GameMode {
  readonly id = "one-flag";
  readonly spawnProvider: SpawnProvider = new AssignedSpawnProvider();

  constructor(
    private readonly map: WorldMapData,
    private readonly config: OneFlagModeConfig = V2_ONE_FLAG_CONFIG,
  ) {}

  initialize(world: WorldState): readonly GameEvent[] {
    world.modeId = this.id;
    world.match = createMatchState(
      "one-flag-match-1",
      this.id,
      this.config.durationMs,
    );
    world.match.phase = "running";
    world.scoreBoard = createScoreBoardState(this.config.initialScores);
    world.objectives = [
      createFlagObjective({
        id: "center-flag",
        kind: "neutral-flag",
        position: centerOf(
          this.map.gameplay.combatZone ??
            boundsRect(this.map),
        ),
      }),
    ];
    return [this.matchStartedEvent(world)];
  }

  update(world: WorldState, deltaMs: number): readonly GameEvent[] {
    const match = world.match;
    if (!match || match.phase !== "running") return [];
    const ms = Math.max(0, deltaMs);
    match.elapsedMs = Math.min(match.durationMs, match.elapsedMs + ms);
    match.remainingMs = Math.max(0, match.durationMs - match.elapsedMs);
    if (match.remainingMs <= 0) return this.endMatch(world, "time-limit");

    const events: GameEvent[] = [];
    this.syncCarriedFlag(world, events);
    for (const actor of world.actors) {
      if (actor.lifeState !== "active" || !actor.teamId) continue;
      const carriedFlag = flagCarriedBy(world, actor.id);
      if (carriedFlag) {
        if (pointInRect(actor.position, this.captureTargetFor(actor.teamId))) {
          events.push(...this.captureFlag(world, carriedFlag, actor.id));
          if (world.match?.phase === "ended") break;
        }
        continue;
      }
      const flag = neutralFlagAtHome(world);
      if (
        flag &&
        distance(actor.position, flag.position) < this.config.pickupRadius
      ) {
        replaceObjective(world, flag.id, {
          ...flag,
          state: {
            ...flag.state,
            status: "carried",
            interactingActorId: actor.id,
          },
        });
        events.push({
          id: `flag-picked-up-${flag.id}-${actor.id}-${world.timeMs}`,
          type: "objective.flagPickedUp",
          timeMs: world.timeMs,
          sourceActorId: actor.id,
          teamId: actor.teamId,
          payload: {
            objectiveId: flag.id,
            flagTeamId: null,
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
    const flag = actorId ? flagCarriedBy(world, actorId) : undefined;
    return flag ? this.resetFlag(world, flag, event.type) : [];
  }

  isComplete(world: WorldSnapshot): boolean {
    return world.match?.phase === "ended";
  }

  getHudState(world: WorldSnapshot): ModeHudState {
    const flag = world.objectives.find(isNeutralFlag);
    const carrier = world.actors.find((actor) =>
      actor.id === flag?.state.interactingActorId
    );
    return {
      modeId: this.id,
      phase: world.match?.phase ?? "notStarted",
      timeRemainingMs: world.match?.remainingMs,
      elapsedTimeMs: world.match?.elapsedMs,
      matchResult: world.match?.result ?? null,
      scores: world.scoreBoard.entries,
      objectives: world.objectives,
      notices: carrier?.teamId
        ? [`${carrier.teamId} carries the center flag`]
        : [`Carry the center flag to the enemy base`],
    };
  }

  private syncCarriedFlag(
    world: WorldState,
    events: GameEvent[],
  ): void {
    const flag = world.objectives.find(isNeutralFlag);
    if (!flag || flag.state.status !== "carried") return;
    const carrier = world.actors.find((actor) =>
      actor.id === flag.state.interactingActorId
    );
    if (!carrier || carrier.lifeState !== "active") {
      events.push(...this.resetFlag(world, flag, "carrier-inactive"));
      return;
    }
    replaceObjective(world, flag.id, {
      ...flag,
      position: {
        x: carrier.position.x,
        y: carrier.position.y - 24 - carrier.jump.height,
      },
    });
  }

  private captureFlag(
    world: WorldState,
    flag: Objective,
    actorId: ActorId,
  ): readonly GameEvent[] {
    const actor = world.actors.find((candidate) => candidate.id === actorId);
    if (!actor?.teamId) return [];
    const scoreEntry = world.scoreBoard.entries.find((entry) =>
      entry.teamId === actor.teamId
    );
    if (!scoreEntry) return [];
    const awardKey = `one-flag-capture:${actor.teamId}:${world.timeMs}:${actor.lifeId}`;
    const award = awardScore(world.scoreBoard, scoreEntry.id, 1, awardKey);
    if (!award.awarded) return [];
    this.resetFlagToCenter(world, flag);
    const events: GameEvent[] = [{
      id: `flag-captured-${flag.id}-${actor.id}-${world.timeMs}`,
      type: "objective.flagCaptured",
      timeMs: world.timeMs,
      sourceActorId: actor.id,
      teamId: actor.teamId,
      payload: {
        objectiveId: flag.id,
        flagTeamId: null,
        captureTargetTeamId: opposingTeam(actor.teamId),
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
        reason: "one-flag-capture",
        awardKey,
      },
    }];
    if (award.score >= this.config.captureLimit) {
      events.push(...this.endMatch(world, "capture-limit"));
    }
    return events;
  }

  private resetFlag(
    world: WorldState,
    flag: Objective,
    reason: string,
  ): readonly GameEvent[] {
    this.resetFlagToCenter(world, flag);
    return [{
      id: `flag-reset-${flag.id}-${world.timeMs}`,
      type: "objective.flagReset",
      timeMs: world.timeMs,
      payload: {
        objectiveId: flag.id,
        flagTeamId: null,
        reason,
      },
    }];
  }

  private resetFlagToCenter(
    world: WorldState,
    flag: Objective,
  ): void {
    replaceObjective(world, flag.id, {
      ...flag,
      position: centerOf(
        this.map.gameplay.combatZone ?? boundsRect(this.map),
      ),
      state: {
        ...flag.state,
        status: "home",
        interactingActorId: null,
      },
    });
  }

  private captureTargetFor(teamId: TeamId): WorldMapPresentationRect {
    return teamId === "red"
      ? this.map.gameplay.blueBase
      : this.map.gameplay.redBase;
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
    if (!match) throw new Error("One Flag match state must exist.");
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

function boundsRect(map: WorldMapData): WorldMapPresentationRect {
  const bounds = map.geometry.bounds;
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function centerOf(rect: WorldMapPresentationRect): {
  readonly x: number;
  readonly y: number;
} {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function neutralFlagAtHome(world: WorldState): Objective | undefined {
  return world.objectives.find((objective) =>
    isNeutralFlag(objective) && objective.state.status === "home"
  );
}

function flagCarriedBy(
  world: WorldState,
  actorId: ActorId,
): Objective | undefined {
  return world.objectives.find((objective) =>
    isNeutralFlag(objective) &&
    objective.state.status === "carried" &&
    objective.state.interactingActorId === actorId
  );
}

function isNeutralFlag(objective: Readonly<Objective>): boolean {
  return objective.kind === "neutral-flag";
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

function opposingTeam(teamId: TeamId): TeamId {
  return teamId === "red" ? "blue" : "red";
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
