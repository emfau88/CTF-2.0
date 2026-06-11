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
