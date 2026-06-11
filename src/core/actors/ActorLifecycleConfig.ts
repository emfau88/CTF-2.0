export interface ActorLifecycleConfig {
  readonly respawnDelayMs: number;
  readonly respawnArmor: number;
  readonly diagnosticDamage: number;
}

export const V2_ACTOR_LIFECYCLE_CONFIG: ActorLifecycleConfig = {
  respawnDelayMs: 900,
  respawnArmor: 0,
  diagnosticDamage: 35,
};
