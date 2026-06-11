import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { ModeHudState } from "../modes";
import type { WorldSnapshot } from "../world";
import type { CoreFrameResult, CoreRuntime } from "./coreRuntime";

const MODE_ID = "inert";
const NO_EVENTS: readonly GameEvent[] = [];

export class InertCoreRuntime implements CoreRuntime {
  private currentTimeMs = 0;
  private currentSnapshot = this.createSnapshot();

  get snapshot(): WorldSnapshot {
    return this.currentSnapshot;
  }

  initialize(): CoreFrameResult {
    this.currentTimeMs = 0;
    return this.createFrameResult();
  }

  advance(input: CoreInputFrame): CoreFrameResult {
    this.currentTimeMs += Math.max(0, input.deltaMs);
    return this.createFrameResult();
  }

  private createFrameResult(): CoreFrameResult {
    this.currentSnapshot = this.createSnapshot();
    return {
      snapshot: this.currentSnapshot,
      events: NO_EVENTS,
      hudState: this.createHudState(),
    };
  }

  private createSnapshot(): WorldSnapshot {
    return {
      timeMs: this.currentTimeMs,
      modeId: MODE_ID,
      actors: [],
      objectives: [],
      scores: [],
    };
  }

  private createHudState(): ModeHudState {
    return {
      modeId: MODE_ID,
      phase: "inert",
      scores: [],
      objectives: [],
      notices: [],
    };
  }
}
