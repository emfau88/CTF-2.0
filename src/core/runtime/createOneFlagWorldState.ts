import {
  assertWorldMapSupportsMode,
  type WorldMapData,
  type WorldState,
} from "../world";
import {
  DEFAULT_ARENA_TEAM_SIZE,
  type ArenaWorldOptions,
} from "../spawning/arenaRoster";
import { createTeamDeathmatchWorldState } from "./createTeamDeathmatchWorldState";

export function createOneFlagWorldState(
  map: WorldMapData,
  options: ArenaWorldOptions = {},
): WorldState {
  const teamSize = options.teamSize ?? DEFAULT_ARENA_TEAM_SIZE;
  assertWorldMapSupportsMode(map, "one-flag", teamSize);
  const world = createTeamDeathmatchWorldState(map, options);
  world.modeId = "one-flag";
  return world;
}
