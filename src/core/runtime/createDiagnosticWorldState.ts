import { createActorState } from "../actors";
import {
  createPickupState,
  V2_DIAGNOSTIC_PICKUP_CONFIG,
} from "../pickups";
import {
  createEmptyWorldState,
  TRAINING_CROSSING_V2,
  type WorldState,
} from "../world";

const MODE_ID = "inert";

export function createDiagnosticWorldState(): WorldState {
  const world = createEmptyWorldState(MODE_ID);
  world.geometry = {
    bounds: { ...TRAINING_CROSSING_V2.geometry.bounds },
    solids: TRAINING_CROSSING_V2.geometry.solids.map((solid) => ({
      ...solid,
    })),
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
  const blueSpawn = requireSpawnPoint(world, "blue-player-spawn");
  world.actors.push(createActorState({
    id: "diagnostic-actor-1",
    kind: "diagnostic",
    teamId: "blue",
    spawnPointId: blueSpawn.id,
    lifeState: "active",
    position: { ...blueSpawn.position },
    spawnPosition: { ...blueSpawn.position },
    velocity: { x: 0, y: 0 },
    facing: { ...(blueSpawn.facing ?? { x: 1, y: 0 }) },
    radius: 24,
    health: 75,
    maxHealth: 100,
    armor: 25,
    maxArmor: 50,
  }));
  world.actors.push(
    createRedTarget(world, 1, "red-target-spawn-1"),
    createRedTarget(world, 2, "red-target-spawn-2"),
    createRedTarget(world, 3, "red-target-spawn-3"),
  );
  world.pickups.push(
    createPickupState(
      {
        id: "diagnostic-health-1",
        type: "health",
        position: { x: 150, y: 480 },
      },
      V2_DIAGNOSTIC_PICKUP_CONFIG,
    ),
    createPickupState(
      {
        id: "diagnostic-armor-1",
        type: "armor",
        position: { x: 240, y: 480 },
      },
      V2_DIAGNOSTIC_PICKUP_CONFIG,
    ),
  );
  return world;
}

function createRedTarget(
  world: WorldState,
  targetNumber: number,
  spawnPointId: string,
): ReturnType<typeof createActorState> {
  const spawn = requireSpawnPoint(world, spawnPointId);
  return createActorState({
    id: `diagnostic-target-${targetNumber}`,
    kind: "diagnostic-target",
    teamId: "red",
    spawnPointId: spawn.id,
    lifeState: "active",
    position: { ...spawn.position },
    spawnPosition: { ...spawn.position },
    velocity: { x: 0, y: 0 },
    facing: { ...(spawn.facing ?? { x: -1, y: 0 }) },
    radius: 24,
    health: 100,
    maxHealth: 100,
    armor: 20,
    maxArmor: 20,
  });
}

function requireSpawnPoint(
  world: WorldState,
  spawnPointId: string,
): WorldState["spawnPoints"][number] {
  const spawnPoint = world.spawnPoints.find((candidate) =>
    candidate.id === spawnPointId
  );
  if (!spawnPoint) {
    throw new Error(`Missing diagnostic spawn point: ${spawnPointId}`);
  }
  return spawnPoint;
}
