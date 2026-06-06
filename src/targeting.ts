import type { TeamId } from "./config";
import { len, lineIntersectsRect, type Rect, type Vec2 } from "./math";
import type { Bot } from "./systems";

type TargetingOwner = Vec2 & { team: TeamId };

export function findNearestVisibleEnemy(
  owner: TargetingOwner,
  bots: Bot[],
  walls: Rect[],
  maxRange = Infinity,
) {
  return bots
    .filter((bot) => bot.alive && bot.team !== owner.team)
    .filter((bot) => !walls.some((wall) => lineIntersectsRect(owner, bot, wall)))
    .filter((bot) => len(owner.x - bot.x, owner.y - bot.y) <= maxRange)
    .sort((a, b) => len(owner.x - a.x, owner.y - a.y) - len(owner.x - b.x, owner.y - b.y))[0];
}
