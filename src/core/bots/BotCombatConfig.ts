import {
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_V1_WEAPON_PARITY_CONFIG,
} from "../combat";

export interface BotCombatConfig {
  readonly rocketMinRange: number;
  readonly rocketMaxRange: number;
  readonly rocketDecisionCooldownMs: number;
  readonly railPreferredMinRange: number;
  readonly railRange: number;
  readonly whipRange: number;
}

export const V2_BOT_COMBAT_CONFIG: BotCombatConfig = {
  rocketMinRange: 190,
  rocketMaxRange: 700,
  rocketDecisionCooldownMs: V2_BASIC_AUTOSHOOT_PARITY_CONFIG.cooldownMs,
  railPreferredMinRange: V2_BASIC_AUTOSHOOT_PARITY_CONFIG.attackRange,
  railRange: V2_V1_WEAPON_PARITY_CONFIG.railRange,
  whipRange: V2_V1_WEAPON_PARITY_CONFIG.whipRange,
};
