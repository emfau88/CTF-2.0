export interface DiagnosticWeaponConfig {
  readonly projectileSpeed: number;
  readonly projectileDamage: number;
  readonly projectileRadius: number;
  readonly projectileLifetimeMs: number;
  readonly projectileRange: number;
  readonly muzzleOffset: number;
  readonly cooldownMs: number;
  readonly maxDeltaMs: number;
}

export const V2_DIAGNOSTIC_BLASTER_CONFIG: DiagnosticWeaponConfig = {
  projectileSpeed: 620,
  projectileDamage: 30,
  projectileRadius: 6,
  projectileLifetimeMs: 1200,
  projectileRange: 720,
  muzzleOffset: 10,
  cooldownMs: 220,
  maxDeltaMs: 34,
};
