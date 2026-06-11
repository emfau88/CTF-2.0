import type { GroundMovementConfig } from "./movementTypes";

export const V2_GROUND_PARITY_CONFIG: GroundMovementConfig = {
  acceleration: 1580,
  maxSpeed: 335,
  friction: 7,
  inputFriction: 1.25,
  turnPenalty: .68,
  turnPenaltyDot: -.28,
  strafeBonus: 1.12,
  inputThreshold: .05,
  steeringSpeedThreshold: 20,
  turnVelocityFloor: .62,
  strafeDotMin: -.15,
  strafeDotMax: .72,
  distanceScale: .93,
  maxDeltaMs: 34,
};
