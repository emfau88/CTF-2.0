import { GRAND_ARCHIVE_V2 } from "./grandArchiveV2";
import { TRAINING_CROSSING_V2 } from "./trainingCrossingV2";
import type { WorldMapData } from "./worldMapData";

export const WORLD_MAPS: readonly WorldMapData[] = [
  TRAINING_CROSSING_V2,
  GRAND_ARCHIVE_V2,
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
