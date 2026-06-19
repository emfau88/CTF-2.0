import type { WorldPosition } from "../../actors";
import {
  arenaSpawnPointId,
  type ArenaTeamId,
  type ArenaTeamSlot,
} from "../../spawning/arenaRoster";
import type { SpawnPoint } from "../../spawning/spawnProvider";

export interface CreateTeamSpawnPointsInput {
  readonly teamId: ArenaTeamId;
  readonly position: WorldPosition;
  readonly facing: WorldPosition;
  readonly tags?: readonly string[];
}

export function createTeamSpawnPoints(
  input: CreateTeamSpawnPointsInput,
): readonly SpawnPoint[] {
  const inwardX = Math.sign(input.facing.x) || (input.teamId === "red" ? 1 : -1);
  return ([
    { slot: 1, offsetX: 0, offsetY: 0 },
    { slot: 2, offsetX: 40, offsetY: -55 },
    { slot: 3, offsetX: 40, offsetY: 55 },
    { slot: 4, offsetX: 80, offsetY: 0 },
  ] as const).map(({ slot, offsetX, offsetY }) => ({
    id: arenaSpawnPointId(input.teamId, slot as ArenaTeamSlot),
    teamId: input.teamId,
    position: {
      x: input.position.x + inwardX * offsetX,
      y: input.position.y + offsetY,
    },
    facing: { ...input.facing },
    tags: input.tags ? [...input.tags] : undefined,
  }));
}
