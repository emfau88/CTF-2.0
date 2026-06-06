export const T = {
  worldWidth: 1500, worldHeight: 820,
  playerRadius: 16, acceleration: 1580, maxSpeed: 335,
  friction: 7.0, inputFriction: 1.25, airFriction: 1.05, airControl: 0.72,
  turnPenalty: 0.68, turnPenaltyDot: -0.28, strafeBonus: 1.12,
  jumpMinDuration: 180, jumpMaxDuration: 620, jumpHoldExtendRate: 1.18,
  jumpCooldown: 540, jumpHeight: 62, jumpClearHeightRatio: 0.34,
  jumpDistanceInfluence: 0.93, lowSpeedJumpBoost: 100,
  fallRespawnMs: 420, safePointInterval: 120, gapDangerInsetRatio: .2,
  projectileSpeed: 260, fireRate: 800, botFireRate: 1000, attackRange: 520, projectileDamage: 18, projectileRadius: 9,
  rocketSpeed: 371, rocketDamage: 45, rocketProjectileRadius: 14, rocketAmmo: 5,
  rocketSplashRadius: 105, rocketKnockback: 230,
  railAmmo: 5, railCooldownMs: 4000, railRange: 1100, railDamageRatio: .95, railBeamLifeMs: 190,
  pickupRadius: 22, pickupRespawnMs: 20000, weaponDropLifetimeMs: 15000, healthPackHealRatio: .5, armorPackRatio: .25,
  playerMaxHp: 100, botMaxHp: 70, botSpeed: 72, respawnDelay: 900,
  trailIntervalMs: 18, trailLifeMs: 280, trailMax: 28,
};

export const TEAM = {
  red: { color: 0xe45151, dark: 0xb7272d, base: 0xffd7d3 },
  blue: { color: 0x3777e6, dark: 0x255ec8, base: 0xd7e5ff },
};

export type TeamId = keyof typeof TEAM;
