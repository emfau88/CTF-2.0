import type { Actor, ActorId } from "../actors";
import type { GameEvent } from "../events";
import type { GameModeId } from "../modes";
import type { Objective } from "../objectives";
import type { ScoreBoard, ScoreEntry } from "../scoring";

export interface WorldState {
  timeMs: number;
  modeId: GameModeId;
  actors: Map<ActorId, Actor>;
  objectives: Map<string, Objective>;
  scoreBoard: ScoreBoard;
  events: GameEvent[];
}

export interface WorldSnapshot {
  readonly timeMs: number;
  readonly modeId: GameModeId;
  readonly actors: readonly Readonly<Actor>[];
  readonly objectives: readonly Readonly<Objective>[];
  readonly scores: readonly ScoreEntry[];
}
