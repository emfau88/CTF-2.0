import type { GameEvent } from "../events";

export interface CollisionConfig {
  readonly maxDeltaMs: number;
  readonly collisionPasses: number;
  readonly separationEpsilon: number;
  readonly solidClearHeight: number;
  readonly gapClearHeight: number;
  readonly gapDangerInsetRatio: number;
  readonly gapOverlapRadiusRatio: number;
  readonly safePositionIntervalMs: number;
  readonly fallDurationMs: number;
  readonly respawnDelayMs: number;
  readonly fallVelocityScale: number;
}

export interface WorldCollisionResult {
  readonly collided: boolean;
  readonly fell: boolean;
  readonly respawned: boolean;
  readonly events: readonly GameEvent[];
}
