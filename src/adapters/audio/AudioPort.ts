import type { GameEvent, WorldSnapshot } from "../../core";

export interface AudioPort {
  handleEvents(
    events: readonly GameEvent[],
    snapshot: WorldSnapshot,
  ): void;
  reset(): void;
  dispose(): void;
}
