import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { ModeHudState } from "../modes";
import {
  createWorldSnapshot,
  type WorldSnapshot,
  type WorldState,
} from "../world";
import type { CoreFrameResult, CoreRuntime } from "./coreRuntime";
import { createDiagnosticWorldState } from "./createDiagnosticWorldState";

const MODE_ID = "inert";
const NO_EVENTS: readonly GameEvent[] = [];

export class InertCoreRuntime implements CoreRuntime {
  private readonly world: WorldState = createDiagnosticWorldState();
  private currentSnapshot = createWorldSnapshot(this.world);

  get snapshot(): WorldSnapshot {
    return this.currentSnapshot;
  }

  initialize(): CoreFrameResult {
    this.world.timeMs = 0;
    return this.createFrameResult();
  }

  advance(input: CoreInputFrame): CoreFrameResult {
    this.world.timeMs += Math.max(0, input.deltaMs);
    return this.createFrameResult();
  }

  private createFrameResult(): CoreFrameResult {
    this.currentSnapshot = createWorldSnapshot(this.world);
    return {
      snapshot: this.currentSnapshot,
      events: NO_EVENTS,
      hudState: this.createHudState(),
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
