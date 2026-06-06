import type { TeamId } from "./config";
import type { LevelData } from "./level";
import { Bot, type BotRole } from "./systems";

const BOT_ROLES: BotRole[] = ["attacker", "defender", "support", "attacker"];

export function createTeamBots(level: LevelData, team: TeamId, count: number) {
  const spawn = team === "red" ? level.redSpawn : level.blueSpawn;
  const side = team === "red" ? 1 : -1;
  const offsets = [
    { x: 80 * side, y: -110 },
    { x: 80 * side, y: 110 },
    { x: 145 * side, y: 0 },
    { x: 55 * side, y: 0 },
  ];

  return Array.from({ length: count }, (_, index) => {
    const offset = offsets[index] ?? offsets[0];
    const role = BOT_ROLES[index] ?? "attacker";
    return new Bot(spawn.x + offset.x, spawn.y + offset.y, team, role, level);
  });
}
