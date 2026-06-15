import {
  assertWorldMapSupportsMode,
  type WorldMapData,
  type WorldState,
} from "../world";
import { createTeamDeathmatchWorldState } from "./createTeamDeathmatchWorldState";

export function createOneFlagWorldState(map: WorldMapData): WorldState {
  assertWorldMapSupportsMode(map, "one-flag");
  const world = createTeamDeathmatchWorldState(map);
  world.modeId = "one-flag";
  return world;
}
