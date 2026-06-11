import type {
  JumpConfig,
  JumpInput,
  JumpMovementResult,
  JumpMovementState,
} from "./jumpTypes";

export function applyJumpMovement(
  state: JumpMovementState,
  input: JumpInput,
  deltaMs: number,
  config: JumpConfig,
): JumpMovementResult {
  const jump = state.jump;
  const ms = Math.min(Math.max(0, deltaMs), config.maxDeltaMs);
  let started = false;
  let landed = false;

  if (input.pressed && !jump.active && jump.cooldownRemainingMs <= 0) {
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    if (speed < config.lowSpeedThreshold) {
      state.velocity.x += state.lastMoveDirection.x * config.lowSpeedBoost;
      state.velocity.y += state.lastMoveDirection.y * config.lowSpeedBoost;
    }
    jump.active = true;
    jump.held = true;
    jump.grounded = false;
    jump.phase = "held";
    jump.elapsedMs = 0;
    jump.plannedDurationMs = config.minDurationMs;
    jump.cooldownRemainingMs = config.cooldownMs;
    started = true;
  }

  if (input.released || (jump.active && !input.held)) {
    jump.held = false;
  }

  jump.cooldownRemainingMs = Math.max(
    0,
    jump.cooldownRemainingMs - ms,
  );

  if (!jump.active) {
    jump.grounded = true;
    jump.height = 0;
    jump.phase = jump.cooldownRemainingMs > 0 ? "cooldown" : "ready";
    return { started, landed };
  }

  jump.elapsedMs += ms;
  if (jump.held) {
    jump.plannedDurationMs = Math.min(
      config.maxDurationMs,
      jump.plannedDurationMs + ms * config.holdExtendRate,
    );
    if (jump.plannedDurationMs >= config.maxDurationMs) {
      jump.held = false;
    }
  }

  const progress = Math.min(1, jump.elapsedMs / jump.plannedDurationMs);
  jump.height = Math.sin(progress * Math.PI) * config.height;
  jump.phase = jump.held ? "held" : "airborne";

  if (progress >= 1) {
    jump.active = false;
    jump.held = false;
    jump.grounded = true;
    jump.phase = jump.cooldownRemainingMs > 0 ? "cooldown" : "ready";
    jump.elapsedMs = 0;
    jump.height = 0;
    landed = true;
  }

  return { started, landed };
}
