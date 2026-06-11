import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { ModeHudState } from "../modes";
import {
  applyDamage,
  updateActorLifecycle,
  V2_ACTOR_LIFECYCLE_CONFIG,
} from "../actors";
import {
  applyJumpMovement,
  applyWorldCollision,
  V2_COLLISION_GROUNDWORK_CONFIG,
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
    if (!actor) {
      this.currentEvents = [];
      return this.createFrameResult();
    }

    if (actor.lifeState === "falling") {
      const collision = applyWorldCollision(
        actor,
        this.world.geometry,
        input.deltaMs,
        this.world.timeMs,
        V2_COLLISION_GROUNDWORK_CONFIG,
      );
      this.currentEvents = collision.events;
      return this.createFrameResult();
    }

    if (
      actor.lifeState === "dead" ||
      actor.lifeState === "respawning"
    ) {
      const lifecycle = updateActorLifecycle(
        actor,
        input.deltaMs,
        this.world.timeMs,
        V2_ACTOR_LIFECYCLE_CONFIG,
      );
      this.currentEvents = lifecycle.events;
      return this.createFrameResult();
    }

    const damage = this.readDiagnosticDamage(input);
    const damageResult = damage > 0
      ? applyDamage(
        actor,
        damage,
        this.world.timeMs,
        V2_ACTOR_LIFECYCLE_CONFIG,
      )
      : null;
    if (damageResult?.killed) {
      this.currentEvents = damageResult.events;
      return this.createFrameResult();
    }

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
    const previousPosition = { ...actor.position };
    applyDiagnosticGroundMovement(actor, input);
    const collision = applyWorldCollision(
      actor,
      this.world.geometry,
      input.deltaMs,
      this.world.timeMs,
      V2_COLLISION_GROUNDWORK_CONFIG,
    );
    const movementEvent = actor.position.x !== previousPosition.x ||
        actor.position.y !== previousPosition.y
      ? {
        id: `diagnostic-move-${input.sequence}`,
        type: "diagnostic.actorMoved",
        timeMs: this.world.timeMs,
        sourceActorId: actor.id,
        teamId: actor.teamId ?? undefined,
        payload: {
          movementMode: "v2-ground-parity",
          position: { ...actor.position },
          velocity: { ...actor.velocity },
        },
      } satisfies GameEvent
      : null;
    const lifecycleEvents = damageResult?.events ?? [];
    this.currentEvents = movementEvent
      ? [...lifecycleEvents, movementEvent, ...collision.events]
      : [...lifecycleEvents, ...collision.events];
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

  private readDiagnosticDamage(input: CoreInputFrame): number {
    const action = input.actions.find((intent) =>
      intent.action === "debugDamage" && intent.phase === "pressed"
    );
    if (
      !action?.payload ||
      typeof action.payload !== "object" ||
      !("amount" in action.payload)
    ) {
      return 0;
    }
    const amount = (action.payload as { amount?: unknown }).amount;
    return typeof amount === "number" ? Math.max(0, amount) : 0;
  }
}
