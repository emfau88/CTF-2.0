import { createActorState } from "../actors";
import {
  createPickupState,
  V2_ARENA_PICKUP_PARITY_CONFIG,
} from "../pickups";
import {
  assertWorldMapSupportsMode,
  createEmptyWorldState,
  TRAINING_CROSSING_V2,
  type WorldMapData,
  type WorldState,
} from "../world";

export function createTeamDeathmatchWorldState(
  map: WorldMapData = TRAINING_CROSSING_V2,
): WorldState {
  assertWorldMapSupportsMode(map, "team-deathmatch");
  const world = createEmptyWorldState("team-deathmatch");
  world.geometry = {
    bounds: { ...map.geometry.bounds },
    solids: map.geometry.solids.map((solid) => ({ ...solid })),
    gaps: map.geometry.gaps.map((gap) => ({ ...gap })),
  };
  world.navigation = {
    jumpLinks: map.navigation.jumpLinks.map((link) => ({
      ...link,
      from: { ...link.from },
      to: { ...link.to },
    })),
  };
  world.map = {
    id: map.id,
    displayName: map.displayName,
  };
  world.spawnPoints = map.spawnPoints.map((spawnPoint) => ({
    ...spawnPoint,
    position: { ...spawnPoint.position },
    facing: spawnPoint.facing ? { ...spawnPoint.facing } : undefined,
    tags: spawnPoint.tags ? [...spawnPoint.tags] : undefined,
  }));
  world.actors.push(
    createPlayer(world, "blue-player", "blue", "blue-player-spawn"),
    createPlayer(world, "red-player", "red", "red-player-spawn"),
  );
  world.pickups.push(...map.pickupSpawns.map((pickup) =>
    createPickupState({
      id: pickup.id,
      type: pickup.type,
      position: { ...pickup.position },
    }, V2_ARENA_PICKUP_PARITY_CONFIG)
  ));
  return world;
}

function createPlayer(
  world: WorldState,
  actorId: string,
  teamId: string,
  spawnPointId: string,
): ReturnType<typeof createActorState> {
  const spawn = world.spawnPoints.find((candidate) =>
    candidate.id === spawnPointId && candidate.teamId === teamId
  );
  if (!spawn) {
    throw new Error(`Missing ${teamId} TDM spawn: ${spawnPointId}`);
  }
  return createActorState({
    id: actorId,
    kind: "player",
    teamId,
    spawnPointId: spawn.id,
    position: { ...spawn.position },
    spawnPosition: { ...spawn.position },
    facing: { ...(spawn.facing ?? { x: 1, y: 0 }) },
    radius: 16,
    health: 100,
    maxHealth: 100,
    armor: 0,
    maxArmor: 100,
  });
}
