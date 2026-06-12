export interface BasicAutoAttackConfig {
  readonly attackRange: number;
  readonly cooldownMs: number;
  readonly projectileSpeed: number;
  readonly projectileDamage: number;
  readonly projectileRadius: number;
  readonly projectileLifetimeMs: number;
  readonly muzzleOffset: number;
}

export const V2_BASIC_AUTOSHOOT_PARITY_CONFIG: BasicAutoAttackConfig = {
  attackRange: 520,
  cooldownMs: 3000,
  projectileSpeed: 286,
  projectileDamage: 18,
  projectileRadius: 9,
  projectileLifetimeMs: 2600,
  muzzleOffset: 3,
};
