import type { GameEvent } from "../events";
import {
  awardScore,
  createScoreBoardState,
  type ScoreEntry,
} from "../scoring";
import {
  AssignedSpawnProvider,
  type SpawnProvider,
} from "../spawning";
import type { WorldSnapshot, WorldState } from "../world";
import type { GameMode, ModeHudState } from "./gameMode";
import { createMatchState, type MatchResult } from "./matchState";

export interface TeamDeathmatchModeConfig {
  readonly durationMs: number;
  readonly scoreLimit: number;
  readonly initialScores: readonly ScoreEntry[];
}

export const V2_TEAM_DEATHMATCH_CONFIG: TeamDeathmatchModeConfig = {
  durationMs: 120_000,
  scoreLimit: 10,
  initialScores: [
    { id: "blue", teamId: "blue", score: 0 },
    { id: "red", teamId: "red", score: 0 },
  ],
};

export class TeamDeathmatchMode implements GameMode {
  readonly id = "team-deathmatch";
  readonly spawnProvider: SpawnProvider = new AssignedSpawnProvider();

  constructor(
    private readonly config: TeamDeathmatchModeConfig =
      V2_TEAM_DEATHMATCH_CONFIG,
  ) {}

  initialize(world: WorldState): readonly GameEvent[] {
    world.modeId = this.id;
    world.match = createMatchState(
      "team-deathmatch-match-1",
      this.id,
      this.config.durationMs,
    );
    world.match.phase = "running";
    world.scoreBoard = createScoreBoardState(this.config.initialScores);
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
    return match.remainingMs > 0 ? [] : this.endMatch(world, "time-limit");
  }

  handleEvent(event: GameEvent, world: WorldState): readonly GameEvent[] {
    if (
      event.type !== "actor.died" ||
      world.match?.phase !== "running"
    ) {
      return [];
    }
    const source = world.actors.find((actor) =>
      actor.id === event.sourceActorId
    );
    const victim = world.actors.find((actor) =>
      actor.id === event.targetActorId
    );
    const victimLifeId = readVictimLifeId(event.payload);
    if (
      !source?.teamId ||
      !victim?.teamId ||
      source.id === victim.id ||
      source.teamId === victim.teamId ||
      victim.lifeState !== "dead" ||
      victimLifeId === null ||
      victim.lifeId !== victimLifeId
    ) {
      return [];
    }
    const scoreEntry = world.scoreBoard.entries.find((entry) =>
      entry.teamId === source.teamId
    );
    if (!scoreEntry) {
      return [];
    }
    const awardKey = `kill:${victim.id}:${victimLifeId}`;
    const award = awardScore(world.scoreBoard, scoreEntry.id, 1, awardKey);
    if (!award.awarded) {
      return [];
    }

    const events: GameEvent[] = [{
      id: `score-awarded-${awardKey}`,
      type: "score.awarded",
      timeMs: event.timeMs,
      sourceActorId: source.id,
      targetActorId: victim.id,
      teamId: source.teamId,
      payload: {
        entryId: scoreEntry.id,
        amount: 1,
        score: award.score,
        reason: "kill",
        reasonEventId: event.id,
        awardKey,
      },
    }];
    if (award.score >= this.config.scoreLimit) {
      events.push(...this.endMatch(world, "score-limit"));
    }
    return events;
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
      objectives: [],
      notices: [`First to ${this.config.scoreLimit}`],
    };
  }

  private endMatch(
    world: WorldState,
    reason: "score-limit" | "time-limit",
  ): readonly GameEvent[] {
    const match = world.match;
    if (!match || match.phase === "ended") {
      return [];
    }
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
    if (!match) {
      throw new Error("TDM match state must exist before start.");
    }
    return {
      id: `match-started-${match.id}`,
      type: "match.started",
      timeMs: world.timeMs,
      payload: {
        matchId: match.id,
        modeId: this.id,
        durationMs: match.durationMs,
        scoreLimit: this.config.scoreLimit,
      },
    };
  }
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

function readVictimLifeId(payload: unknown): number | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("victimLifeId" in payload)
  ) {
    return null;
  }
  const lifeId = (payload as { victimLifeId?: unknown }).victimLifeId;
  return typeof lifeId === "number" && Number.isSafeInteger(lifeId) &&
      lifeId > 0
    ? lifeId
    : null;
}
