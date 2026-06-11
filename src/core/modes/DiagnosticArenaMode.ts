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
  playerScoreEntryId: "diagnostic-team",
  initialScores: [
    { id: "diagnostic-team", teamId: "diagnostic-team", score: 0 },
    {
      id: "diagnostic-opponent",
      teamId: "diagnostic-opponent",
      score: 0,
    },
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
    if (
      event.type !== "diagnostic.scoreRequested" ||
      world.match?.phase !== "running"
    ) {
      return [];
    }
    const entryId = this.config.playerScoreEntryId;
    const amount = readScoreAmount(event.payload);
    if (amount === 0) {
      return [];
    }
    const score = awardScore(world.scoreBoard, entryId, amount);
    return [{
      id: `score-awarded-${event.id}`,
      type: "score.awarded",
      timeMs: event.timeMs,
      sourceActorId: event.sourceActorId,
      teamId: event.teamId,
      payload: {
        entryId,
        amount,
        score,
        reasonEventId: event.id,
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
