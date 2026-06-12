import type { GameEvent } from "../events";
import type { GameMode } from "../modes";
import type { WorldState } from "../world";

export function dispatchModeEvents(
  mode: GameMode,
  world: WorldState,
  frameEvents: GameEvent[],
  gameplayEvents: readonly GameEvent[],
): void {
  for (const event of gameplayEvents) {
    frameEvents.push(event);
    frameEvents.push(...mode.handleEvent(event, world));
  }
}
