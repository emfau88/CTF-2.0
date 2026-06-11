import type { WorldPosition, WorldVelocity } from "../actors";

export interface GroundMovementConfig {
  readonly acceleration: number;
  readonly maxSpeed: number;
  readonly friction: number;
  readonly inputFriction: number;
  readonly turnPenalty: number;
  readonly turnPenaltyDot: number;
  readonly strafeBonus: number;
  readonly inputThreshold: number;
  readonly steeringSpeedThreshold: number;
  readonly turnVelocityFloor: number;
  readonly strafeDotMin: number;
  readonly strafeDotMax: number;
  readonly distanceScale: number;
  readonly maxDeltaMs: number;
}

export interface GroundMovementInput {
  readonly direction: WorldPosition;
  readonly magnitude: number;
}

export interface GroundMovementState {
  position: WorldPosition;
  velocity: WorldVelocity;
  facing: WorldPosition;
}

export interface GroundMovementResult {
  readonly deltaSeconds: number;
  readonly friction: number;
  readonly speed: number;
  readonly moved: boolean;
}
