import type { GameEvent } from "../events";
import type { Objective } from "../objectives";
import type { ScoreEntry } from "../scoring";
import type { SpawnProvider } from "../spawning";
import type { WorldSnapshot, WorldState } from "../world";

export type GameModeId = string;

export interface ModeHudState {
  readonly modeId: GameModeId;
  readonly phase: string;
  readonly timeRemainingMs?: number;
  readonly scores: readonly ScoreEntry[];
  readonly objectives: readonly Readonly<Objective>[];
  readonly notices: readonly string[];
}

export interface GameMode {
  readonly id: GameModeId;
  readonly spawnProvider: SpawnProvider;

  initialize(world: WorldState): readonly GameEvent[];
  update(world: WorldState, deltaMs: number): readonly GameEvent[];
  handleEvent(event: GameEvent, world: WorldState): readonly GameEvent[];
  isComplete(world: WorldSnapshot): boolean;
  getHudState(world: WorldSnapshot): ModeHudState;
}
