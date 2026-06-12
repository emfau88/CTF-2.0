import type { WorldPosition } from "../actors";
import type { PickupConfig } from "./PickupConfig";
import type { PickupId, PickupState, PickupType } from "./pickup";

export interface CreatePickupStateInput {
  readonly id: PickupId;
  readonly type: PickupType;
  readonly position: WorldPosition;
  readonly radius?: number;
  readonly value?: number;
  readonly respawnDelayMs?: number;
}

export function createPickupState(
  input: CreatePickupStateInput,
  config: PickupConfig,
): PickupState {
  const defaultValue = valueForType(input.type, config);
  return {
    id: input.id,
    type: input.type,
    position: { ...input.position },
    radius: input.radius ?? config.defaultRadius,
    value: input.value ?? defaultValue,
    respawnDelayMs: input.respawnDelayMs ??
      config.defaultRespawnDelayMs,
    lifeState: "active",
    respawnRemainingMs: 0,
  };
}

function valueForType(type: PickupType, config: PickupConfig): number {
  if (type === "health") return config.healthValue;
  if (type === "armor") return config.armorValue;
  if (type === "rocket") return config.rocketValue;
  if (type === "rail") return config.railValue;
  return config.whipValue;
}
