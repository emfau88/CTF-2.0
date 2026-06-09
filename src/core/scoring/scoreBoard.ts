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
