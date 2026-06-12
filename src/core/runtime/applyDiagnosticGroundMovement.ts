import type { ActorState } from "../actors";
import type { CoreInputFrame } from "../input";
import {
  applyGroundMovement,
  type GroundMovementResult,
  V2_GROUND_PARITY_CONFIG,
} from "../movement";

export function applyDiagnosticGroundMovement(
  actor: ActorState,
  input: CoreInputFrame,
): GroundMovementResult {
  const move = input.actions.find((intent) =>
    intent.action === "move" &&
    (!intent.actorId || intent.actorId === actor.id)
  );
  return applyGroundMovement(
    actor,
    {
      direction: move?.direction ?? { x: 0, y: 0 },
      magnitude: move?.magnitude ?? 0,
      grounded: actor.jump.grounded,
    },
    input.deltaMs,
    V2_GROUND_PARITY_CONFIG,
  );
}
