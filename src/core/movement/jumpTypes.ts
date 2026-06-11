import type {
  ActorJumpState,
  WorldFacing,
  WorldVelocity,
} from "../actors";

export interface JumpConfig {
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly holdExtendRate: number;
  readonly cooldownMs: number;
  readonly height: number;
  readonly lowSpeedThreshold: number;
  readonly lowSpeedBoost: number;
  readonly maxDeltaMs: number;
}

export interface JumpInput {
  readonly pressed: boolean;
  readonly held: boolean;
  readonly released: boolean;
}

export interface JumpMovementState {
  velocity: WorldVelocity;
  lastMoveDirection: WorldFacing;
  jump: ActorJumpState;
}

export interface JumpMovementResult {
  readonly started: boolean;
  readonly landed: boolean;
}
