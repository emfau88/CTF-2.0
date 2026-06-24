import type { CollisionConfig } from "./collisionTypes";

export const V2_COLLISION_GROUNDWORK_CONFIG: CollisionConfig = {
  maxDeltaMs: 34,
  collisionPasses: 3,
  separationEpsilon: .1,
  solidClearHeight: 31,
  gapClearHeight: 62 * .34,
  gapDangerInsetRatio: .2,
  gapOverlapRadiusRatio: .68,
  safePositionIntervalMs: 120,
  fallDurationMs: 750,
  respawnDelayMs: 4_000,
  fallVelocityScale: .18,
};
