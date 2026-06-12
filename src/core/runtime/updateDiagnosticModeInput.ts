import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { GameMode } from "../modes";
import type { WorldState } from "../world";
import { hasCoreAction } from "./updateDiagnosticControlledActor";

export function updateDiagnosticModeInput(
  world: WorldState,
  mode: GameMode,
  input: CoreInputFrame,
  events: GameEvent[],
): void {
  if (!hasCoreAction(input, "debugScore", "pressed")) {
    return;
  }
  const actor = world.actors[0];
  const request: GameEvent = {
    id: `diagnostic-score-request-${input.sequence}`,
    type: "diagnostic.scoreRequested",
    timeMs: world.timeMs,
    sourceActorId: actor?.id,
    teamId: actor?.teamId ?? undefined,
    payload: { amount: 1 },
  };
  events.push(...mode.handleEvent(request, world));
}
