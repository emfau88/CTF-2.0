import type { ModeHudState, WorldSnapshot } from "../../core";

export interface HudPort {
  render(
    state: ModeHudState,
    snapshot: WorldSnapshot,
  ): void;
  reset(): void;
  dispose(): void;
}
