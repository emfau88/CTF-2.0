import type { ActorState, WorldPosition } from "../actors";
import type { CoreActionIntent } from "../input";
import type { WorldRect, WorldSnapshot } from "../world";
import {
  V2_BOT_COMBAT_CONFIG,
  type BotCombatConfig,
} from "./BotCombatConfig";

type BotWeaponId = "rocket" | "rail" | "whip";

export class TdmBotCombatController {
  private rocketDecisionCooldownMs = 0;

  constructor(
    private readonly config: BotCombatConfig = V2_BOT_COMBAT_CONFIG,
  ) {}

  readAction(
    actor: Readonly<ActorState>,
    target: Readonly<ActorState>,
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): CoreActionIntent | null {
    this.rocketDecisionCooldownMs = Math.max(
      0,
      this.rocketDecisionCooldownMs - Math.max(0, deltaMs),
    );
    if (
      actor.lifeState !== "active" ||
      target.lifeState !== "active" ||
      !actor.teamId ||
      !target.teamId ||
      actor.teamId === target.teamId ||
      !hasLineOfSight(actor.position, target.position, snapshot.geometry.solids)
    ) {
      return null;
    }

    const direction = directionBetween(actor.position, target.position);
    const distance = distanceBetween(actor.position, target.position);
    const weaponId = this.chooseWeapon(actor, target, distance);
    if (!weaponId) {
      return null;
    }
    if (weaponId === "rocket") {
      this.rocketDecisionCooldownMs = this.config.rocketDecisionCooldownMs;
    }
    return {
      action: "fireWeapon",
      phase: "pressed",
      actorId: actor.id,
      direction,
      payload: { weaponId },
    };
  }

  reset(): void {
    this.rocketDecisionCooldownMs = 0;
  }

  private chooseWeapon(
    actor: Readonly<ActorState>,
    target: Readonly<ActorState>,
    distance: number,
  ): BotWeaponId | null {
    if (
      actor.weapons.whipAmmo > 0 &&
      actor.weapons.whipCooldownMs <= 0 &&
      distance <= this.config.whipRange + target.radius
    ) {
      return "whip";
    }
    if (
      actor.weapons.railAmmo > 0 &&
      actor.weapons.railCooldownMs <= 0 &&
      distance <= this.config.railRange &&
      distance >= this.config.railPreferredMinRange
    ) {
      return "rail";
    }
    if (
      actor.weapons.rocketAmmo > 0 &&
      this.rocketDecisionCooldownMs <= 0 &&
      distance >= this.config.rocketMinRange &&
      distance <= this.config.rocketMaxRange
    ) {
      return "rocket";
    }
    if (
      actor.weapons.railAmmo > 0 &&
      actor.weapons.railCooldownMs <= 0 &&
      distance <= this.config.railRange
    ) {
      return "rail";
    }
    return null;
  }
}

export function directionBetween(
  from: WorldPosition,
  to: WorldPosition,
): WorldPosition {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > .0001 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
}

export function distanceBetween(a: WorldPosition, b: WorldPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function hasLineOfSight(
  from: WorldPosition,
  to: WorldPosition,
  solids: readonly WorldRect[],
): boolean {
  return !solids.some((solid) => lineIntersectsRect(from, to, solid));
}

function lineIntersectsRect(
  from: WorldPosition,
  to: WorldPosition,
  rect: WorldRect,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let near = 0;
  let far = 1;
  for (const [origin, direction, min, max] of [
    [from.x, dx, rect.x, rect.x + rect.width],
    [from.y, dy, rect.y, rect.y + rect.height],
  ] as const) {
    if (Math.abs(direction) < .0001) {
      if (origin < min || origin > max) {
        return false;
      }
      continue;
    }
    const first = (min - origin) / direction;
    const second = (max - origin) / direction;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) {
      return false;
    }
  }
  return far >= 0 && near <= 1;
}
