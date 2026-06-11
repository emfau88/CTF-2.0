import type { ActorState, WorldPosition } from "../actors";
import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";

const DIAGNOSTIC_SPEED = 160;
const DIAGNOSTIC_BOUNDS = {
  minX: 100,
  maxX: 560,
  minY: 48,
  maxY: 500,
} as const;

interface ActorMovedPayload {
  readonly position: WorldPosition;
  readonly velocity: WorldPosition;
}

export function applyDiagnosticMovement(
  actor: ActorState,
  input: CoreInputFrame,
  timeMs: number,
): GameEvent<"diagnostic.actorMoved", ActorMovedPayload> | null {
  const move = input.actions.find((intent) => intent.action === "move");
  const direction = move?.direction ?? { x: 0, y: 0 };
  const deltaSeconds = Math.max(0, input.deltaMs) / 1000;
  const previousX = actor.position.x;
  const previousY = actor.position.y;

  const requestedVelocityX = direction.x * DIAGNOSTIC_SPEED;
  const requestedVelocityY = direction.y * DIAGNOSTIC_SPEED;
  actor.position.x = clamp(
    actor.position.x + requestedVelocityX * deltaSeconds,
    DIAGNOSTIC_BOUNDS.minX,
    DIAGNOSTIC_BOUNDS.maxX,
  );
  actor.position.y = clamp(
    actor.position.y + requestedVelocityY * deltaSeconds,
    DIAGNOSTIC_BOUNDS.minY,
    DIAGNOSTIC_BOUNDS.maxY,
  );
  actor.velocity.x = deltaSeconds > 0
    ? (actor.position.x - previousX) / deltaSeconds
    : 0;
  actor.velocity.y = deltaSeconds > 0
    ? (actor.position.y - previousY) / deltaSeconds
    : 0;

  if (direction.x !== 0 || direction.y !== 0) {
    actor.facing.x = direction.x;
    actor.facing.y = direction.y;
  }

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
      position: { ...actor.position },
      velocity: { ...actor.velocity },
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
