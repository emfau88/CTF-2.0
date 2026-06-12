import type { WorldPosition } from "../../actors";
import type { SpawnPoint } from "../../spawning";
import type { WorldGeometry } from "../worldGeometry";

export interface WorldMapData {
  readonly id: string;
  readonly displayName: string;
  readonly geometry: WorldGeometry;
  readonly spawnPoints: readonly SpawnPoint[];
  readonly diagnosticSpawn: WorldPosition;
}

export interface WorldMapInfo {
  readonly id: string;
  readonly displayName: string;
}
