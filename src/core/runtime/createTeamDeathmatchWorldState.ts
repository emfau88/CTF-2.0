import { createActorState } from "../actors";
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
