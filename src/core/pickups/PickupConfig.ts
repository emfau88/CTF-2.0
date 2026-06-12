export interface PickupConfig {
  readonly defaultRadius: number;
  readonly defaultRespawnDelayMs: number;
  readonly healthValue: number;
  readonly armorValue: number;
}

export const V2_DIAGNOSTIC_PICKUP_CONFIG: PickupConfig = {
  defaultRadius: 18,
  defaultRespawnDelayMs: 1800,
  healthValue: 30,
  armorValue: 20,
};

export const V2_ARENA_PICKUP_PARITY_CONFIG: PickupConfig = {
  defaultRadius: 22,
  defaultRespawnDelayMs: 20_000,
  healthValue: 50,
  armorValue: 25,
};
