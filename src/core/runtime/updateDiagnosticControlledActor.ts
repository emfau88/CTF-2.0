import {
  applyDamage,
  type ActorState,
  V2_ACTOR_LIFECYCLE_CONFIG,
} from "../actors";
import {
  fireDiagnosticProjectile,
  V2_DIAGNOSTIC_BLASTER_CONFIG,
} from "../combat";
import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import {
  applyJumpMovement,
  applyWorldCollision,
  V2_COLLISION_GROUNDWORK_CONFIG,
  V2_JUMP_PARITY_CONFIG,
} from "../movement";
import type { WorldState } from "../world";
import { applyDiagnosticGroundMovement } from "./applyDiagnosticGroundMovement";

export function updateDiagnosticControlledActor(
  world: WorldState,
  actor: ActorState,
  input: CoreInputFrame,
  allowManualPrimaryFire = true,
): readonly GameEvent[] {
  const events: GameEvent[] = [];
  const damage = readDiagnosticDamage(input);
  if (damage > 0) {
    const damageResult = applyDamage(
      actor,
      damage,
      world.timeMs,
      V2_ACTOR_LIFECYCLE_CONFIG,
    );
    events.push(...damageResult.events);
    if (damageResult.killed) {
      return events;
    }
  }

  if (
    allowManualPrimaryFire &&
    hasAction(input, "firePrimary", "held")
  ) {
    const fire = fireDiagnosticProjectile(
      actor,
      readAimDirection(input),
      input.sequence,
      world.timeMs,
      V2_DIAGNOSTIC_BLASTER_CONFIG,
    );
    if (fire.projectile) {
      world.projectiles.push(fire.projectile);
    }
    events.push(...fire.events);
  }

  updateLastMoveDirection(actor, input);
  applyJumpMovement(
    actor,
    {
      pressed: hasAction(input, "jump", "pressed"),
      held: hasAction(input, "jump", "held"),
      released: hasAction(input, "jump", "released"),
    },
    input.deltaMs,
    V2_JUMP_PARITY_CONFIG,
  );
  const previousPosition = { ...actor.position };
  applyDiagnosticGroundMovement(actor, input);
  const collision = applyWorldCollision(
    actor,
    world.geometry,
    input.deltaMs,
    world.timeMs,
    V2_COLLISION_GROUNDWORK_CONFIG,
  );
  if (
    actor.position.x !== previousPosition.x ||
    actor.position.y !== previousPosition.y
  ) {
    events.push({
      id: `diagnostic-move-${input.sequence}`,
      type: "diagnostic.actorMoved",
      timeMs: world.timeMs,
      sourceActorId: actor.id,
      teamId: actor.teamId ?? undefined,
      payload: {
        movementMode: "v2-ground-parity",
        position: { ...actor.position },
        velocity: { ...actor.velocity },
      },
    });
  }
  events.push(...collision.events);
  return events;
}

export function hasCoreAction(
  input: CoreInputFrame,
  action: string,
  phase: "pressed" | "held" | "released",
): boolean {
  return input.actions.some((intent) =>
    intent.action === action && intent.phase === phase
  );
}

function hasAction(
  input: CoreInputFrame,
  action: string,
  phase: "pressed" | "held" | "released",
): boolean {
  return hasCoreAction(input, action, phase);
}

function updateLastMoveDirection(
  actor: ActorState,
  input: CoreInputFrame,
): void {
  const move = input.actions.find((intent) =>
    intent.action === "move" &&
    (!intent.actorId || intent.actorId === actor.id)
  );
  if (
    (move?.magnitude ?? 0) > .05 &&
    move?.direction &&
    (move.direction.x !== 0 || move.direction.y !== 0)
  ) {
    actor.lastMoveDirection.x = move.direction.x;
    actor.lastMoveDirection.y = move.direction.y;
  }
}

function readDiagnosticDamage(input: CoreInputFrame): number {
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

function readAimDirection(input: CoreInputFrame): {
  x: number;
  y: number;
} {
  return input.actions.find((intent) => intent.action === "aim")
    ?.direction ?? { x: 0, y: 0 };
}
