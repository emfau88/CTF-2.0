export interface PickupConfig {
  readonly defaultRadius: number;
  readonly defaultRespawnDelayMs: number;
  readonly healthValue: number;
  readonly armorValue: number;
  readonly rocketValue: number;
  readonly railValue: number;
  readonly whipValue: number;
}

export const V2_DIAGNOSTIC_PICKUP_CONFIG: PickupConfig = {
  defaultRadius: 18,
  defaultRespawnDelayMs: 1800,
  healthValue: 30,
  armorValue: 20,
  rocketValue: 5,
  railValue: 5,
  whipValue: 8,
};

export const V2_ARENA_PICKUP_PARITY_CONFIG: PickupConfig = {
  defaultRadius: 22,
  defaultRespawnDelayMs: 20_000,
  healthValue: 50,
  armorValue: 25,
  rocketValue: 5,
  railValue: 5,
  whipValue: 8,
};
