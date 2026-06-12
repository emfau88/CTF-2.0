import {
  updateProjectiles,
  V2_DIAGNOSTIC_BLASTER_CONFIG,
} from "../combat";
import { V2_ACTOR_LIFECYCLE_CONFIG } from "../actors";
import type { GameEvent } from "../events";
import type { GameMode } from "../modes";
import type { WorldState } from "../world";
import { dispatchModeEvents } from "./dispatchModeEvents";

export function updateCombatWorld(
  world: WorldState,
  mode: GameMode,
  deltaMs: number,
  events: GameEvent[],
): void {
  const projectiles = updateProjectiles(
    world.projectiles,
    world.actors,
    world.geometry,
    deltaMs,
    world.timeMs,
    V2_DIAGNOSTIC_BLASTER_CONFIG,
    V2_ACTOR_LIFECYCLE_CONFIG,
  );
  dispatchModeEvents(mode, world, events, projectiles.events);
}
