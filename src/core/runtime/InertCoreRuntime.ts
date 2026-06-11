import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { ModeHudState } from "../modes";
import {
  applyJumpMovement,
  V2_JUMP_PARITY_CONFIG,
} from "../movement";
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
    if (actor) {
      this.updateLastMoveDirection(actor, input);
      applyJumpMovement(
        actor,
        {
          pressed: this.hasAction(input, "jump", "pressed"),
          held: this.hasAction(input, "jump", "held"),
          released: this.hasAction(input, "jump", "released"),
        },
        input.deltaMs,
        V2_JUMP_PARITY_CONFIG,
      );
    }
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

  private updateLastMoveDirection(
    actor: WorldState["actors"][number],
    input: CoreInputFrame,
  ): void {
    const move = input.actions.find((intent) => intent.action === "move");
    if (
      (move?.magnitude ?? 0) > .05 &&
      move?.direction &&
      (move.direction.x !== 0 || move.direction.y !== 0)
    ) {
      actor.lastMoveDirection.x = move.direction.x;
      actor.lastMoveDirection.y = move.direction.y;
    }
  }

  private hasAction(
    input: CoreInputFrame,
    action: string,
    phase: "pressed" | "held" | "released",
  ): boolean {
    return input.actions.some((intent) =>
      intent.action === action && intent.phase === phase
    );
  }
}
