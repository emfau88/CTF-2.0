export interface V1WeaponConfig {
  readonly rocketSpeed: number;
  readonly rocketDamage: number;
  readonly rocketRadius: number;
  readonly rocketAmmo: number;
  readonly rocketCooldownMs: number;
  readonly rocketSplashRadius: number;
  readonly rocketKnockback: number;
  readonly projectileLifetimeMs: number;
  readonly railAmmo: number;
  readonly railCooldownMs: number;
  readonly railRange: number;
  readonly railDamageRatio: number;
  readonly whipAmmo: number;
  readonly whipCooldownMs: number;
  readonly whipRange: number;
  readonly whipHalfAngle: number;
  readonly whipDamage: number;
}

export const V2_V1_WEAPON_PARITY_CONFIG: V1WeaponConfig = {
  rocketSpeed: 371,
  rocketDamage: 45,
  rocketRadius: 14,
  rocketAmmo: 5,
  rocketCooldownMs: 1000,
  rocketSplashRadius: 105,
  rocketKnockback: 230,
  projectileLifetimeMs: 2600,
  railAmmo: 5,
  railCooldownMs: 2500,
  railRange: 1100,
  railDamageRatio: .95,
  whipAmmo: 8,
  whipCooldownMs: 800,
  whipRange: 120,
  whipHalfAngle: Math.PI * 35 / 180,
  whipDamage: 35,
};
