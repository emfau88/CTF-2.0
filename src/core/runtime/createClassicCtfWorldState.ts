import type { WorldMapData, WorldState } from "../world";
import { createTeamDeathmatchWorldState } from "./createTeamDeathmatchWorldState";

export function createClassicCtfWorldState(map: WorldMapData): WorldState {
  const world = createTeamDeathmatchWorldState(map);
  world.modeId = "classic-ctf";
  return world;
}
