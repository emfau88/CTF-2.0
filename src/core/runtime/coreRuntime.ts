import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { ModeHudState } from "../modes";
import type { WorldSnapshot } from "../world";

export interface CoreFrameResult {
  readonly snapshot: WorldSnapshot;
  readonly events: readonly GameEvent[];
  readonly hudState: ModeHudState;
}

export interface CoreRuntime {
  readonly snapshot: WorldSnapshot;

  initialize(): CoreFrameResult;
  advance(input: CoreInputFrame): CoreFrameResult;
}
