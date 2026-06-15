import {
  assertWorldMapSupportsMode,
  type WorldMapData,
  type WorldState,
} from "../world";
import { createTeamDeathmatchWorldState } from "./createTeamDeathmatchWorldState";

export function createClassicCtfWorldState(map: WorldMapData): WorldState {
  assertWorldMapSupportsMode(map, "classic-ctf");
  const world = createTeamDeathmatchWorldState(map);
  world.modeId = "classic-ctf";
  return world;
}
