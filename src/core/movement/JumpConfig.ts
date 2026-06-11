import type { JumpConfig } from "./jumpTypes";

export const V2_JUMP_PARITY_CONFIG: JumpConfig = {
  minDurationMs: 180,
  maxDurationMs: 620,
  holdExtendRate: 1.18,
  cooldownMs: 540,
  height: 62,
  lowSpeedThreshold: 34,
  lowSpeedBoost: 100,
  maxDeltaMs: 34,
};
