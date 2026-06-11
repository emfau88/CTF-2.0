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
  fallRespawnMs: 420,
  fallVelocityScale: .18,
};
