import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import {
  DiagnosticArenaMode,
  type GameMode,
  type ModeHudState,
} from "../modes";
import {
  applyWorldCollision,
  V2_COLLISION_GROUNDWORK_CONFIG,
} from "../movement";
import {
  createWorldSnapshot,
  type WorldSnapshot,
  type WorldState,
} from "../world";
import type { CoreFrameResult, CoreRuntime } from "./coreRuntime";
import { createDiagnosticWorldState } from "./createDiagnosticWorldState";
import { dispatchModeEvents } from "./dispatchModeEvents";
import { updateActorWorld } from "./updateActorWorld";
import { updateCombatWorld } from "./updateCombatWorld";
import { updateDiagnosticControlledActor } from "./updateDiagnosticControlledActor";
import { updateDiagnosticModeInput } from "./updateDiagnosticModeInput";
import { updatePickupWorld } from "./updatePickupWorld";

export interface GameplayCoreRuntimeOptions {
  readonly mode?: GameMode;
  readonly createWorld?: () => WorldState;
}

export class GameplayCoreRuntime implements CoreRuntime {
  private readonly mode: GameMode;
  private readonly createWorld: () => WorldState;
  private world: WorldState;
  private currentSnapshot: WorldSnapshot;
  private currentEvents: readonly GameEvent[] = [];

  constructor(options: GameplayCoreRuntimeOptions = {}) {
    this.mode = options.mode ?? new DiagnosticArenaMode();
    this.createWorld = options.createWorld ?? createDiagnosticWorldState;
    this.world = this.createWorld();
    this.currentSnapshot = createWorldSnapshot(this.world);
  }

  get snapshot(): WorldSnapshot {
    return this.currentSnapshot;
  }

  initialize(): CoreFrameResult {
    this.world = this.createWorld();
    this.currentEvents = this.mode.initialize(this.world);
    return this.createFrameResult();
  }

  advance(input: CoreInputFrame): CoreFrameResult {
    if (isMatchEnded(this.world)) {
      this.currentEvents = [];
      return this.createFrameResult();
    }

    this.world.timeMs += Math.max(0, input.deltaMs);
    const events: GameEvent[] = [];
    events.push(...this.mode.update(this.world, input.deltaMs));
    if (isMatchEnded(this.world)) {
      this.currentEvents = events;
      return this.createFrameResult();
    }

    updateActorWorld(this.world, this.mode, input.deltaMs, events);
    updateDiagnosticModeInput(this.world, this.mode, input, events);
    this.updateControlledActor(input, events);
    updateCombatWorld(this.world, this.mode, input.deltaMs, events);
    updatePickupWorld(this.world, this.mode, input.deltaMs, events);

    this.currentEvents = events;
    return this.createFrameResult();
  }

  private updateControlledActor(
    input: CoreInputFrame,
    events: GameEvent[],
  ): void {
    const actor = this.world.actors[0];
    if (!actor) {
      return;
    }
    if (actor.lifeState === "falling") {
      const collision = applyWorldCollision(
        actor,
        this.world.geometry,
        input.deltaMs,
        this.world.timeMs,
        V2_COLLISION_GROUNDWORK_CONFIG,
      );
      dispatchModeEvents(this.mode, this.world, events, collision.events);
      return;
    }
    if (actor.lifeState === "active") {
      dispatchModeEvents(
        this.mode,
        this.world,
        events,
        updateDiagnosticControlledActor(this.world, actor, input),
      );
    }
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
    return this.mode.getHudState(this.currentSnapshot);
  }
}

function isMatchEnded(world: WorldState): boolean {
  return world.match?.phase === "ended";
}
