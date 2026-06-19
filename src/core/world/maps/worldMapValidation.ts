import type { GameModeId } from "../../modes";
import {
  arenaSpawnPointId,
  type ArenaTeamSize,
  type ArenaTeamSlot,
  DEFAULT_ARENA_TEAM_SIZE,
} from "../../spawning/arenaRoster";
import type { SpawnPoint } from "../../spawning/spawnProvider";
import type { WorldMapData, WorldMapPresentationRect } from "./worldMapData";

export interface WorldMapValidationIssue {
  readonly code:
    | "invalid-bounds"
    | "missing-red-base"
    | "missing-blue-base"
    | "missing-combat-zone"
    | "missing-red-player-spawn"
    | "missing-blue-player-spawn"
    | "missing-team-spawn"
    | "invalid-team-spawn"
    | "overlapping-team-spawns";
  readonly message: string;
}

export function validateWorldMapForMode(
  map: WorldMapData,
  modeId: GameModeId,
  teamSize: ArenaTeamSize = DEFAULT_ARENA_TEAM_SIZE,
): readonly WorldMapValidationIssue[] {
  const issues: WorldMapValidationIssue[] = [];
  const bounds = map.geometry.bounds;
  if (bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
    issues.push({
      code: "invalid-bounds",
      message: `${map.id} must define positive world bounds.`,
    });
  }
  if (!isValidRect(map.gameplay.redBase)) {
    issues.push({
      code: "missing-red-base",
      message: `${map.id} must define a red base area.`,
    });
  }
  if (!isValidRect(map.gameplay.blueBase)) {
    issues.push({
      code: "missing-blue-base",
      message: `${map.id} must define a blue base area.`,
    });
  }
  if (!hasTeamSpawn(map, "red", "red-player-spawn")) {
    issues.push({
      code: "missing-red-player-spawn",
      message: `${map.id} must define the red player spawn.`,
    });
  }
  if (!hasTeamSpawn(map, "blue", "blue-player-spawn")) {
    issues.push({
      code: "missing-blue-player-spawn",
      message: `${map.id} must define the blue player spawn.`,
    });
  }
  if (modeId === "one-flag" && !isValidRect(map.gameplay.combatZone)) {
    issues.push({
      code: "missing-combat-zone",
      message: `${map.id} must define a combat zone for One Flag.`,
    });
  }
  validateAdditionalTeamSpawns(map, teamSize, issues);
  return issues;
}

export function assertWorldMapSupportsMode(
  map: WorldMapData,
  modeId: GameModeId,
  teamSize: ArenaTeamSize = DEFAULT_ARENA_TEAM_SIZE,
): void {
  const issues = validateWorldMapForMode(map, modeId, teamSize);
  if (issues.length === 0) return;
  throw new Error(
    `Invalid ${modeId} map ${map.id}: ${issues.map((issue) => issue.message).join(" ")}`,
  );
}

function validateAdditionalTeamSpawns(
  map: WorldMapData,
  teamSize: ArenaTeamSize,
  issues: WorldMapValidationIssue[],
): void {
  for (const teamId of ["blue", "red"] as const) {
    const teamSpawns: SpawnPoint[] = [];
    for (let slot = 1; slot <= teamSize; slot++) {
      const spawnId = arenaSpawnPointId(teamId, slot as ArenaTeamSlot);
      const spawn = map.spawnPoints.find((candidate) =>
        candidate.id === spawnId && candidate.teamId === teamId
      );
      if (!spawn) {
        if (slot > 1) {
          issues.push({
            code: "missing-team-spawn",
            message: `${map.id} must define ${spawnId} for ${teamSize}v${teamSize}.`,
          });
        }
        continue;
      }
      teamSpawns.push(spawn);
      if (
        !pointInBounds(spawn.position, map) ||
        pointInRects(spawn.position, map.geometry.solids) ||
        pointInRects(spawn.position, map.geometry.gaps)
      ) {
        issues.push({
          code: "invalid-team-spawn",
          message: `${map.id} spawn ${spawnId} must be inside playable space.`,
        });
      }
    }
    for (let left = 0; left < teamSpawns.length; left++) {
      for (let right = left + 1; right < teamSpawns.length; right++) {
        const first = teamSpawns[left]!;
        const second = teamSpawns[right]!;
        if (distance(first.position, second.position) < 36) {
          issues.push({
            code: "overlapping-team-spawns",
            message: `${map.id} spawns ${first.id} and ${second.id} overlap.`,
          });
        }
      }
    }
  }
}

function hasTeamSpawn(
  map: WorldMapData,
  teamId: string,
  spawnId: string,
): boolean {
  return map.spawnPoints.some((spawn) =>
    spawn.id === spawnId && spawn.teamId === teamId
  );
}

function isValidRect(
  rect: WorldMapPresentationRect | undefined,
): rect is WorldMapPresentationRect {
  return rect !== undefined && rect.width > 0 && rect.height > 0;
}

function pointInBounds(
  point: { readonly x: number; readonly y: number },
  map: WorldMapData,
): boolean {
  const bounds = map.geometry.bounds;
  return point.x >= bounds.minX && point.x <= bounds.maxX &&
    point.y >= bounds.minY && point.y <= bounds.maxY;
}

function pointInRects(
  point: { readonly x: number; readonly y: number },
  rects: readonly WorldMapPresentationRect[],
): boolean {
  return rects.some((rect) =>
    point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height
  );
}

function distance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
