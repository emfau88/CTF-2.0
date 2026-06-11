import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { ModeHudState } from "../modes";
import {
  createWorldSnapshot,
  type WorldSnapshot,
  type WorldState,
} from "../world";
import {
  applyDiagnosticGroundMovement,
} from "./applyDiagnosticGroundMovement";
import type { CoreFrameResult, CoreRuntime } from "./coreRuntime";
import { createDiagnosticWorldState } from "./createDiagnosticWorldState";

const MODE_ID = "inert";

export class InertCoreRuntime implements CoreRuntime {
  private world: WorldState = createDiagnosticWorldState();
  private currentSnapshot = createWorldSnapshot(this.world);
  private currentEvents: readonly GameEvent[] = [];

  get snapshot(): WorldSnapshot {
    return this.currentSnapshot;
  }

  initialize(): CoreFrameResult {
    this.world = createDiagnosticWorldState();
    this.currentEvents = [];
    return this.createFrameResult();
  }

  advance(input: CoreInputFrame): CoreFrameResult {
    this.world.timeMs += Math.max(0, input.deltaMs);
    const actor = this.world.actors[0];
    const movementEvent = actor
      ? applyDiagnosticGroundMovement(actor, input, this.world.timeMs)
      : null;
    this.currentEvents = movementEvent ? [movementEvent] : [];
    return this.createFrameResult();
  }

  private createFrameResult(): CoreFrameResult {
    this.currentSnapshot = createWorldSnapshot(this.world);
    return {
      snapshot: this.currentSnapshot,
      events: this.currentEvents,
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
