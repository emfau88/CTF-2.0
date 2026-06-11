import type { GameModeId } from "./gameMode";

export type MatchPhase = "notStarted" | "starting" | "running" | "ended";

export type MatchResult =
  | {
    readonly kind: "winner";
    readonly winnerEntryId: string;
  }
  | {
    readonly kind: "draw";
  };

export interface MatchState {
  readonly id: string;
  readonly modeId: GameModeId;
  phase: MatchPhase;
  readonly durationMs: number;
  elapsedMs: number;
  remainingMs: number;
  result: MatchResult | null;
}

export function createMatchState(
  id: string,
  modeId: GameModeId,
  durationMs: number,
): MatchState {
  const safeDuration = Math.max(0, durationMs);
  return {
    id,
    modeId,
    phase: "notStarted",
    durationMs: safeDuration,
    elapsedMs: 0,
    remainingMs: safeDuration,
    result: null,
  };
}
