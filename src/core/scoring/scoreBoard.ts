import type { ActorId, TeamId } from "../actors";
import type { GameEvent } from "../events";

export interface ScoreEntry {
  readonly id: string;
  readonly score: number;
  readonly teamId?: TeamId;
  readonly actorId?: ActorId;
}

export interface ScoreBoard {
  readonly entries: readonly ScoreEntry[];
  award(entryId: string, amount: number, reason: GameEvent): void;
  scoreFor(entryId: string): number;
  reset(): void;
}

export interface ScoreBoardState {
  entries: ScoreEntry[];
}

export function createScoreBoardState(
  entries: readonly ScoreEntry[] = [],
): ScoreBoardState {
  return {
    entries: entries.map((entry) => ({ ...entry })),
  };
}

export function awardScore(
  scoreBoard: ScoreBoardState,
  entryId: string,
  amount: number,
): number {
  if (!Number.isFinite(amount) || amount === 0) {
    return scoreFor(scoreBoard, entryId);
  }
  const index = scoreBoard.entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) {
    scoreBoard.entries.push({ id: entryId, score: amount });
    return amount;
  }
  const current = scoreBoard.entries[index];
  if (!current) {
    return 0;
  }
  const nextScore = current.score + amount;
  scoreBoard.entries[index] = { ...current, score: nextScore };
  return nextScore;
}

export function scoreFor(
  scoreBoard: ScoreBoardState,
  entryId: string,
): number {
  return scoreBoard.entries.find((entry) => entry.id === entryId)?.score ?? 0;
}
