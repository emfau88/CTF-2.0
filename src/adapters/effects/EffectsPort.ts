import type { GameEvent, WorldSnapshot } from "../../core";

export interface EffectsPort {
  handleEvents(
    events: readonly GameEvent[],
    snapshot: WorldSnapshot,
  ): void;
  update(deltaMs: number, snapshot: WorldSnapshot): void;
  reset(): void;
  dispose(): void;
}
