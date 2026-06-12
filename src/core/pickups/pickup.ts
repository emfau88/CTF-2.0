import type { WorldPosition } from "../actors";

export type PickupId = string;
export type PickupType = "health" | "armor" | "rocket" | "rail" | "whip";
export type PickupLifeState = "active" | "inactive";

export interface PickupState {
  readonly id: PickupId;
  readonly type: PickupType;
  readonly position: WorldPosition;
  readonly radius: number;
  readonly value: number;
  readonly respawnDelayMs: number;
  lifeState: PickupLifeState;
  respawnRemainingMs: number;
}
