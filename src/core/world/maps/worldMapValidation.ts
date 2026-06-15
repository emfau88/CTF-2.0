import type { GameModeId } from "../../modes";
import type { WorldMapData, WorldMapPresentationRect } from "./worldMapData";

export interface WorldMapValidationIssue {
  readonly code:
    | "invalid-bounds"
    | "missing-red-base"
    | "missing-blue-base"
    | "missing-combat-zone"
    | "missing-red-player-spawn"
    | "missing-blue-player-spawn";
  readonly message: string;
}

export function validateWorldMapForMode(
  map: WorldMapData,
  modeId: GameModeId,
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
  return issues;
}

export function assertWorldMapSupportsMode(
  map: WorldMapData,
  modeId: GameModeId,
): void {
  const issues = validateWorldMapForMode(map, modeId);
  if (issues.length === 0) return;
  throw new Error(
    `Invalid ${modeId} map ${map.id}: ${issues.map((issue) => issue.message).join(" ")}`,
  );
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
