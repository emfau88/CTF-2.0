import type {
  SpawnPoint,
  SpawnProvider,
  SpawnRequest,
} from "./spawnProvider";
import type { WorldSnapshot } from "../world";

export class AssignedSpawnProvider implements SpawnProvider {
  getSpawnPoint(
    request: SpawnRequest,
    world: WorldSnapshot,
  ): SpawnPoint | null {
    const actor = world.actors.find((candidate) =>
      candidate.id === request.actorId
    );
    if (!actor) {
      return null;
    }
    return world.spawnPoints.find((spawnPoint) =>
      spawnPoint.id === actor.spawnPointId &&
      spawnPoint.teamId === request.teamId
    ) ?? null;
  }
}
