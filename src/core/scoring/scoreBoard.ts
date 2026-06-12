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
  award(
    entryId: string,
    amount: number,
    awardKey: string,
    reason: GameEvent,
  ): ScoreAwardResult;
  scoreFor(entryId: string): number;
  reset(): void;
}

export interface ScoreBoardState {
  entries: ScoreEntry[];
  processedAwardKeys: string[];
}

export type ScoreAwardRejectionReason =
  | "duplicate"
  | "invalid-amount"
  | "invalid-award-key"
  | "unknown-entry";

export interface ScoreAwardResult {
  readonly awarded: boolean;
  readonly score: number;
  readonly rejectionReason?: ScoreAwardRejectionReason;
}

export function createScoreBoardState(
  entries: readonly ScoreEntry[] = [],
): ScoreBoardState {
  return {
    entries: entries.map((entry) => ({ ...entry })),
    processedAwardKeys: [],
  };
}

export function awardScore(
  scoreBoard: ScoreBoardState,
  entryId: string,
  amount: number,
  awardKey: string,
): ScoreAwardResult {
  const currentScore = scoreFor(scoreBoard, entryId);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return {
      awarded: false,
      score: currentScore,
      rejectionReason: "invalid-amount",
    };
  }
  if (!awardKey.trim()) {
    return {
      awarded: false,
      score: currentScore,
      rejectionReason: "invalid-award-key",
    };
  }
  const index = scoreBoard.entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) {
    return {
      awarded: false,
      score: 0,
      rejectionReason: "unknown-entry",
    };
  }
  if (scoreBoard.processedAwardKeys.includes(awardKey)) {
    return {
      awarded: false,
      score: currentScore,
      rejectionReason: "duplicate",
    };
  }
  const current = scoreBoard.entries[index];
  if (!current) {
    return {
      awarded: false,
      score: 0,
      rejectionReason: "unknown-entry",
    };
  }
  const nextScore = current.score + amount;
  scoreBoard.entries[index] = { ...current, score: nextScore };
  scoreBoard.processedAwardKeys.push(awardKey);
  return { awarded: true, score: nextScore };
}

export function scoreFor(
  scoreBoard: ScoreBoardState,
  entryId: string,
): number {
  return scoreBoard.entries.find((entry) => entry.id === entryId)?.score ?? 0;
}
