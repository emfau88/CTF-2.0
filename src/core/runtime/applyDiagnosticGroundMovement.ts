import type { ActorState, WorldPosition } from "../actors";
import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import {
  applyGroundMovement,
  V2_GROUND_PARITY_CONFIG,
} from "../movement";

const DIAGNOSTIC_BOUNDS = {
  minX: 100,
  maxX: 560,
  minY: 48,
  maxY: 500,
} as const;

interface ActorMovedPayload {
  readonly movementMode: "v2-ground-parity";
  readonly position: WorldPosition;
  readonly velocity: WorldPosition;
}

export function applyDiagnosticGroundMovement(
  actor: ActorState,
  input: CoreInputFrame,
  timeMs: number,
): GameEvent<"diagnostic.actorMoved", ActorMovedPayload> | null {
  const move = input.actions.find((intent) => intent.action === "move");
  const previousX = actor.position.x;
  const previousY = actor.position.y;
  applyGroundMovement(
    actor,
    {
      direction: move?.direction ?? { x: 0, y: 0 },
      magnitude: move?.magnitude ?? 0,
    },
    input.deltaMs,
    V2_GROUND_PARITY_CONFIG,
  );

  clampActorToDiagnosticBounds(actor);
  if (actor.position.x === previousX && actor.position.y === previousY) {
    return null;
  }

  return {
    id: `diagnostic-move-${input.sequence}`,
    type: "diagnostic.actorMoved",
    timeMs,
    sourceActorId: actor.id,
    teamId: actor.teamId ?? undefined,
    payload: {
      movementMode: "v2-ground-parity",
      position: { ...actor.position },
      velocity: { ...actor.velocity },
    },
  };
}

function clampActorToDiagnosticBounds(actor: ActorState): void {
  const clampedX = clamp(
    actor.position.x,
    DIAGNOSTIC_BOUNDS.minX,
    DIAGNOSTIC_BOUNDS.maxX,
  );
  const clampedY = clamp(
    actor.position.y,
    DIAGNOSTIC_BOUNDS.minY,
    DIAGNOSTIC_BOUNDS.maxY,
  );

  if (clampedX !== actor.position.x) {
    actor.velocity.x = 0;
    actor.position.x = clampedX;
  }
  if (clampedY !== actor.position.y) {
    actor.velocity.y = 0;
    actor.position.y = clampedY;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
