import {
  updateActorLifecycle,
  V2_ACTOR_LIFECYCLE_CONFIG,
} from "../actors";
import type { GameEvent } from "../events";
import type { GameMode } from "../modes";
import type { WorldState } from "../world";
import { dispatchModeEvents } from "./dispatchModeEvents";

export function updateActorWorld(
  world: WorldState,
  mode: GameMode,
  deltaMs: number,
  events: GameEvent[],
): void {
  const ms = Math.max(0, deltaMs);
  for (const actor of world.actors) {
    actor.primaryFireCooldownMs = Math.max(
      0,
      actor.primaryFireCooldownMs - ms,
    );
    actor.weapons.rocketCooldownMs = Math.max(
      0,
      actor.weapons.rocketCooldownMs - ms,
    );
    actor.weapons.railCooldownMs = Math.max(
      0,
      actor.weapons.railCooldownMs - ms,
    );
    actor.weapons.whipCooldownMs = Math.max(
      0,
      actor.weapons.whipCooldownMs - ms,
    );
    const lifecycle = updateActorLifecycle(
      actor,
      ms,
      world.timeMs,
      V2_ACTOR_LIFECYCLE_CONFIG,
    );
    dispatchModeEvents(mode, world, events, lifecycle.events);
  }
}
