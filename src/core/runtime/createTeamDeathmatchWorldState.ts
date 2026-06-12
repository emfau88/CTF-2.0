import { createActorState } from "../actors";
import {
  createPickupState,
  V2_ARENA_PICKUP_PARITY_CONFIG,
} from "../pickups";
import {
  createEmptyWorldState,
  TRAINING_CROSSING_V2,
  type WorldState,
} from "../world";

export function createTeamDeathmatchWorldState(): WorldState {
  const world = createEmptyWorldState("team-deathmatch");
  world.geometry = {
    bounds: { ...TRAINING_CROSSING_V2.geometry.bounds },
    solids: TRAINING_CROSSING_V2.geometry.solids.map((solid) => ({ ...solid })),
    gaps: TRAINING_CROSSING_V2.geometry.gaps.map((gap) => ({ ...gap })),
  };
  world.map = {
    id: TRAINING_CROSSING_V2.id,
    displayName: TRAINING_CROSSING_V2.displayName,
  };
  world.spawnPoints = TRAINING_CROSSING_V2.spawnPoints.map((spawnPoint) => ({
    ...spawnPoint,
    position: { ...spawnPoint.position },
    facing: spawnPoint.facing ? { ...spawnPoint.facing } : undefined,
    tags: spawnPoint.tags ? [...spawnPoint.tags] : undefined,
  }));
  world.actors.push(
    createPlayer(world, "blue-player", "blue", "blue-player-spawn"),
    createPlayer(world, "red-player", "red", "red-player-spawn"),
  );
  world.pickups.push(
    createPickupState({
      id: "health-red",
      type: "health",
      position: { x: 120, y: 320 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "armor-red",
      type: "armor",
      position: { x: 220, y: 320 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "health-blue",
      type: "health",
      position: { x: 1290, y: 320 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "armor-blue",
      type: "armor",
      position: { x: 1390, y: 320 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "armor-center",
      type: "armor",
      position: { x: 750, y: 410 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "rocket-red",
      type: "rocket",
      position: { x: 130, y: 500 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "rail-red",
      type: "rail",
      position: { x: 215, y: 500 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "whip-red",
      type: "whip",
      position: { x: 285, y: 410 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "rocket-blue",
      type: "rocket",
      position: { x: 1370, y: 500 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "rail-blue",
      type: "rail",
      position: { x: 1285, y: 500 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
    createPickupState({
      id: "whip-blue",
      type: "whip",
      position: { x: 1215, y: 410 },
    }, V2_ARENA_PICKUP_PARITY_CONFIG),
  );
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
