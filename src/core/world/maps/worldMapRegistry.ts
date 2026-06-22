import { FLANK_SWITCH_V2 } from "./flankSwitchV2";
import { FLOW_CIRCUIT_V2 } from "./flowCircuitV2";
import { FLOW_LAB_V2 } from "./flowLabV2";
import { GRAND_ARCHIVE_V2 } from "./grandArchiveV2";
import { TRAINING_CROSSING_V2 } from "./trainingCrossingV2";
import type { WorldMapData } from "./worldMapData";

export const WORLD_MAPS: readonly WorldMapData[] = [
  TRAINING_CROSSING_V2,
  GRAND_ARCHIVE_V2,
  FLANK_SWITCH_V2,
  FLOW_LAB_V2,
  FLOW_CIRCUIT_V2,
];

const WORLD_MAP_BY_ID = new Map(
  WORLD_MAPS.map((map) => [map.id, map] as const),
);

export function getWorldMap(mapId: string | null | undefined):
  WorldMapData | undefined {
  return mapId ? WORLD_MAP_BY_ID.get(mapId) : undefined;
}

export function resolveWorldMap(
  mapId: string | null | undefined,
): WorldMapData {
  return getWorldMap(mapId) ?? TRAINING_CROSSING_V2;
}
