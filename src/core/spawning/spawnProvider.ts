import type { ActorId, TeamId, WorldPosition } from "../actors";
import type { WorldSnapshot } from "../world";

export interface SpawnPoint {
  readonly id: string;
  readonly position: WorldPosition;
  readonly facing?: WorldPosition;
  readonly teamId?: TeamId;
  readonly tags?: readonly string[];
}

export interface SpawnRequest {
  readonly actorId: ActorId;
  readonly teamId: TeamId | null;
  readonly reason: "initial" | "respawn" | string;
}

export interface SpawnProvider {
  getSpawnPoint(
    request: SpawnRequest,
    world: WorldSnapshot,
  ): SpawnPoint | null;
}
