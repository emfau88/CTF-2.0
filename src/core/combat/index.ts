export {
  V2_DIAGNOSTIC_BLASTER_CONFIG,
  type DiagnosticWeaponConfig,
} from "./DiagnosticWeaponConfig";
export {
  fireDiagnosticProjectile,
  type DiagnosticFireResult,
} from "./diagnosticWeapon";
export type {
  ProjectileId,
  ProjectileLifeState,
  ProjectileState,
  ProjectileWeaponId,
} from "./projectile";
export {
  updateProjectiles,
  type ProjectileUpdateResult,
} from "./updateProjectiles";
export {
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  type BasicAutoAttackConfig,
} from "./BasicAutoAttackConfig";
export { fireBasicAttack, updateBasicAutoAttacks } from "./basicAutoAttack";
export {
  V2_V1_WEAPON_PARITY_CONFIG,
  type V1WeaponConfig,
} from "./V1WeaponConfig";
export { fireV1Weapons } from "./v1Weapons";
