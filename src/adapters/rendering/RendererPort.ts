import type { WorldSnapshot } from "../../core";

export interface RendererPort {
  render(snapshot: WorldSnapshot): void;
  reset(): void;
  dispose(): void;
}
