import type { GameEvent } from "../events";
import {
  awardScore,
  createScoreBoardState,
  type ScoreEntry,
} from "../scoring";
import type {
  SpawnPoint,
  SpawnProvider,
  SpawnRequest,
} from "../spawning";
import type { WorldSnapshot, WorldState } from "../world";
import type { GameMode, ModeHudState } from "./gameMode";
import { createMatchState, type MatchResult } from "./matchState";

export interface DiagnosticArenaModeConfig {
  readonly durationMs: number;
  readonly playerScoreEntryId: string;
  readonly initialScores: readonly ScoreEntry[];
}

export const V2_DIAGNOSTIC_ARENA_MODE_CONFIG: DiagnosticArenaModeConfig = {
  durationMs: 15_000,
  playerScoreEntryId: "blue",
  initialScores: [
    { id: "blue", teamId: "blue", score: 0 },
    { id: "red", teamId: "red", score: 0 },
  ],
};

export class DiagnosticArenaMode implements GameMode {
  readonly id = "diagnostic-arena";
  readonly spawnProvider: SpawnProvider = new DiagnosticSpawnProvider();

  constructor(
    private readonly config: DiagnosticArenaModeConfig =
      V2_DIAGNOSTIC_ARENA_MODE_CONFIG,
  ) {}

  initialize(world: WorldState): readonly GameEvent[] {
    world.modeId = this.id;
    world.match = createMatchState(
      "diagnostic-match-1",
      this.id,
      this.config.durationMs,
    );
    world.match.phase = "running";
    world.scoreBoard = createScoreBoardState(this.config.initialScores);
    return [{
      id: `match-started-${world.match.id}`,
      type: "match.started",
      timeMs: world.timeMs,
      payload: {
        matchId: world.match.id,
        modeId: this.id,
        durationMs: world.match.durationMs,
      },
    }];
  }

  update(world: WorldState, deltaMs: number): readonly GameEvent[] {
    const match = world.match;
    if (!match || match.phase !== "running") {
      return [];
    }

    const ms = Math.max(0, deltaMs);
    match.elapsedMs = Math.min(match.durationMs, match.elapsedMs + ms);
    match.remainingMs = Math.max(0, match.durationMs - match.elapsedMs);
    if (match.remainingMs > 0) {
      return [];
    }

    match.phase = "ended";
    match.result = this.resolveResult(world);
    return [{
      id: `match-ended-${match.id}`,
      type: "match.ended",
      timeMs: world.timeMs,
      payload: {
        matchId: match.id,
        result: match.result,
        scores: world.scoreBoard.entries.map((entry) => ({ ...entry })),
      },
    }];
  }

  handleEvent(event: GameEvent, world: WorldState): readonly GameEvent[] {
    if (world.match?.phase !== "running") {
      return [];
    }

    if (event.type === "actor.died") {
      return this.handleActorDeath(event, world);
    }
    if (event.type !== "diagnostic.scoreRequested") {
      return [];
    }

    return this.tryAwardScore(
      world,
      event,
      this.config.playerScoreEntryId,
      readScoreAmount(event.payload),
      `diagnostic:${event.id}`,
      "diagnostic",
    );
  }

  private handleActorDeath(
    event: GameEvent,
    world: WorldState,
  ): readonly GameEvent[] {
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
      victimLifeId === null ||
      victim.lifeState !== "dead" ||
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

    return this.tryAwardScore(
      world,
      event,
      scoreEntry.id,
      1,
      `kill:${victim.id}:${victimLifeId}`,
      "kill",
    );
  }

  private tryAwardScore(
    world: WorldState,
    event: GameEvent,
    entryId: string,
    amount: number,
    awardKey: string,
    reason: "diagnostic" | "kill",
  ): readonly GameEvent[] {
    const result = awardScore(world.scoreBoard, entryId, amount, awardKey);
    if (!result.awarded) {
      return [];
    }
    const scoreEntry = world.scoreBoard.entries.find((entry) =>
      entry.id === entryId
    );

    return [{
      id: `score-awarded-${awardKey}`,
      type: "score.awarded",
      timeMs: event.timeMs,
      sourceActorId: event.sourceActorId,
      targetActorId: event.targetActorId,
      teamId: scoreEntry?.teamId,
      payload: {
        entryId,
        amount,
        score: result.score,
        reason,
        reasonEventId: event.id,
        awardKey,
      },
    }];
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
      notices: [],
    };
  }

  private resolveResult(world: WorldState): MatchResult {
    const scores = world.scoreBoard.entries;
    const highest = Math.max(...scores.map((entry) => entry.score), 0);
    const leaders = scores.filter((entry) => entry.score === highest);
    return leaders.length === 1 && leaders[0]
      ? { kind: "winner", winnerEntryId: leaders[0].id }
      : { kind: "draw" };
  }
}

class DiagnosticSpawnProvider implements SpawnProvider {
  getSpawnPoint(
    request: SpawnRequest,
    world: WorldSnapshot,
  ): SpawnPoint | null {
    const actor = world.actors.find((candidate) =>
      candidate.id === request.actorId
    );
    return actor
      ? {
        id: `${actor.id}-spawn`,
        position: { ...actor.spawnPosition },
        facing: { ...actor.facing },
        teamId: actor.teamId ?? undefined,
        tags: ["diagnostic"],
      }
      : null;
  }
}

function readScoreAmount(payload: unknown): number {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("amount" in payload)
  ) {
    return 0;
  }
  const amount = (payload as { amount?: unknown }).amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
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
