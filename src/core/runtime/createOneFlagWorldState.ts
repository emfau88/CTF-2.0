import type { WorldMapData, WorldState } from "../world";
import { createTeamDeathmatchWorldState } from "./createTeamDeathmatchWorldState";

export function createOneFlagWorldState(map: WorldMapData): WorldState {
  const world = createTeamDeathmatchWorldState(map);
  world.modeId = "one-flag";
  return world;
}
