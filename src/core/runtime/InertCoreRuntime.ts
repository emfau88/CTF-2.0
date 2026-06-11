import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { ModeHudState } from "../modes";
import {
  applyDamage,
  updateActorLifecycle,
  V2_ACTOR_LIFECYCLE_CONFIG,
} from "../actors";
import {
  fireDiagnosticProjectile,
  updateProjectiles,
  V2_DIAGNOSTIC_BLASTER_CONFIG,
} from "../combat";
import {
  applyJumpMovement,
  applyWorldCollision,
  V2_COLLISION_GROUNDWORK_CONFIG,
  V2_JUMP_PARITY_CONFIG,
} from "../movement";
import { updatePickups } from "../pickups";
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
    const events: GameEvent[] = [];
    this.updateCooldowns(input.deltaMs);
    this.updateLifecycles(input.deltaMs, events);

    const actor = this.world.actors[0];
    if (!actor) {
      this.updateProjectileWorld(input.deltaMs, events);
      this.updatePickupWorld(input.deltaMs, events);
      this.currentEvents = events;
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
      events.push(...collision.events);
    } else if (actor.lifeState === "active") {
      this.updateControlledActor(actor, input, events);
    }

    this.updateProjectileWorld(input.deltaMs, events);
    this.updatePickupWorld(input.deltaMs, events);
    this.currentEvents = events;
    return this.createFrameResult();
  }

  private updateControlledActor(
    actor: WorldState["actors"][number],
    input: CoreInputFrame,
    events: GameEvent[],
  ): void {
    const damage = this.readDiagnosticDamage(input);
    if (damage > 0) {
      const damageResult = applyDamage(
        actor,
        damage,
        this.world.timeMs,
        V2_ACTOR_LIFECYCLE_CONFIG,
      );
      events.push(...damageResult.events);
      if (damageResult.killed) {
        return;
      }
    }

    if (this.hasAction(input, "firePrimary", "held")) {
      const fire = fireDiagnosticProjectile(
        actor,
        this.readAimDirection(input),
        input.sequence,
        this.world.timeMs,
        V2_DIAGNOSTIC_BLASTER_CONFIG,
      );
      if (fire.projectile) {
        this.world.projectiles.push(fire.projectile);
      }
      events.push(...fire.events);
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
    if (movementEvent) {
      events.push(movementEvent);
    }
    events.push(...collision.events);
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

  private readAimDirection(input: CoreInputFrame): {
    x: number;
    y: number;
  } {
    return input.actions.find((intent) => intent.action === "aim")
      ?.direction ?? { x: 0, y: 0 };
  }

  private updateCooldowns(deltaMs: number): void {
    const ms = Math.max(0, deltaMs);
    for (const actor of this.world.actors) {
      actor.primaryFireCooldownMs = Math.max(
        0,
        actor.primaryFireCooldownMs - ms,
      );
    }
  }

  private updateLifecycles(deltaMs: number, events: GameEvent[]): void {
    for (const actor of this.world.actors) {
      const lifecycle = updateActorLifecycle(
        actor,
        deltaMs,
        this.world.timeMs,
        V2_ACTOR_LIFECYCLE_CONFIG,
      );
      events.push(...lifecycle.events);
    }
  }

  private updateProjectileWorld(
    deltaMs: number,
    events: GameEvent[],
  ): void {
    const projectiles = updateProjectiles(
      this.world.projectiles,
      this.world.actors,
      this.world.geometry,
      deltaMs,
      this.world.timeMs,
      V2_DIAGNOSTIC_BLASTER_CONFIG,
      V2_ACTOR_LIFECYCLE_CONFIG,
    );
    events.push(...projectiles.events);
  }

  private updatePickupWorld(
    deltaMs: number,
    events: GameEvent[],
  ): void {
    const collector = this.world.actors[0];
    const pickups = updatePickups(
      this.world.pickups,
      collector ? [collector] : [],
      deltaMs,
      this.world.timeMs,
    );
    events.push(...pickups.events);
  }
}
