import type {
  GroundMovementConfig,
  GroundMovementInput,
  GroundMovementResult,
  GroundMovementState,
} from "./movementTypes";

export function applyGroundMovement(
  state: GroundMovementState,
  input: GroundMovementInput,
  deltaMs: number,
  config: GroundMovementConfig,
): GroundMovementResult {
  const dt = Math.min(Math.max(0, deltaMs), config.maxDeltaMs) / 1000;
  const direction = normalizedDirection(input.direction);
  const magnitude = clamp(input.magnitude, 0, 1);
  const hasInput =
    magnitude > config.inputThreshold &&
    (direction.x !== 0 || direction.y !== 0);
  const previousX = state.position.x;
  const previousY = state.position.y;
  const speedBeforeInput = Math.hypot(state.velocity.x, state.velocity.y);

  if (hasInput) {
    let acceleration = config.acceleration * magnitude;

    if (speedBeforeInput > config.steeringSpeedThreshold) {
      const dot =
        (state.velocity.x / speedBeforeInput) * direction.x +
        (state.velocity.y / speedBeforeInput) * direction.y;

      if (dot < config.turnPenaltyDot) {
        const scale = Math.max(
          config.turnVelocityFloor,
          1 - -dot * config.turnPenalty * dt,
        );
        state.velocity.x *= scale;
        state.velocity.y *= scale;
      } else if (
        dot > config.strafeDotMin &&
        dot < config.strafeDotMax
      ) {
        acceleration *= config.strafeBonus;
      }
    }

    state.velocity.x += direction.x * acceleration * dt;
    state.velocity.y += direction.y * acceleration * dt;
    state.facing.x = direction.x;
    state.facing.y = direction.y;
  }

  const friction = hasInput ? config.inputFriction : config.friction;
  const drag = Math.max(0, 1 - friction * dt);
  state.velocity.x *= drag;
  state.velocity.y *= drag;

  const speedBeforeClamp = Math.hypot(state.velocity.x, state.velocity.y);
  if (speedBeforeClamp > config.maxSpeed) {
    const scale = config.maxSpeed / speedBeforeClamp;
    state.velocity.x *= scale;
    state.velocity.y *= scale;
  }

  state.position.x += state.velocity.x * dt * config.distanceScale;
  state.position.y += state.velocity.y * dt * config.distanceScale;

  return {
    deltaSeconds: dt,
    friction,
    speed: Math.hypot(state.velocity.x, state.velocity.y),
    moved: state.position.x !== previousX || state.position.y !== previousY,
  };
}

function normalizedDirection(
  direction: GroundMovementInput["direction"],
): GroundMovementInput["direction"] {
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1) {
    return { ...direction };
  }
  return { x: direction.x / length, y: direction.y / length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
