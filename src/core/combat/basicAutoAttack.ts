import type { ActorState, WorldPosition } from "../actors";
import type { GameEvent } from "../events";
import type { WorldRect, WorldState } from "../world";
import type { BasicAutoAttackConfig } from "./BasicAutoAttackConfig";
import type { ProjectileState } from "./projectile";

export function updateBasicAutoAttacks(
  world: WorldState,
  config: BasicAutoAttackConfig,
): readonly GameEvent[] {
  const events: GameEvent[] = [];
  for (const actor of world.actors) {
    if (
      actor.lifeState !== "active" ||
      actor.primaryFireCooldownMs > 0 ||
      !actor.teamId
    ) {
      continue;
    }
    const target = selectAutoAttackTarget(actor, world, config);
    if (!target) {
      continue;
    }
    const projectile = createBasicProjectile(
      actor,
      target,
      world.timeMs,
      config,
    );
    world.projectiles.push(projectile);
    actor.primaryFireCooldownMs = config.cooldownMs;
    events.push({
      id: `projectile-spawned-${projectile.id}`,
      type: "projectile.spawned",
      timeMs: world.timeMs,
      sourceActorId: actor.id,
      targetActorId: target.id,
      teamId: actor.teamId,
      payload: {
        projectileId: projectile.id,
        weaponId: "basic-autoshoot",
        position: { ...projectile.position },
        velocity: { ...projectile.velocity },
      },
    });
  }
  return events;
}

function selectAutoAttackTarget(
  owner: ActorState,
  world: WorldState,
  config: BasicAutoAttackConfig,
): ActorState | null {
  let best: ActorState | null = null;
  let bestScore = -Infinity;
  for (const target of world.actors) {
    if (
      target.id === owner.id ||
      target.lifeState !== "active" ||
      !target.teamId ||
      target.teamId === owner.teamId
    ) {
      continue;
    }
    const distance = Math.hypot(
      target.position.x - owner.position.x,
      target.position.y - owner.position.y,
    );
    if (
      distance > config.attackRange ||
      world.geometry.solids.some((solid) =>
        lineIntersectsRect(owner.position, target.position, solid)
      )
    ) {
      continue;
    }
    const score = (target.maxHealth - target.health) - distance * .12;
    if (score > bestScore) {
      best = target;
      bestScore = score;
    }
  }
  return best;
}

function createBasicProjectile(
  owner: ActorState,
  target: ActorState,
  timeMs: number,
  config: BasicAutoAttackConfig,
): ProjectileState {
  const dx = target.position.x - owner.position.x;
  const dy = target.position.y - owner.position.y;
  const distance = Math.hypot(dx, dy) || 1;
  const direction = { x: dx / distance, y: dy / distance };
  const offset = owner.radius + config.projectileRadius + config.muzzleOffset;
  return {
    id: `basic-projectile-${owner.id}-${owner.lifeId}-${timeMs}`,
    ownerActorId: owner.id,
    teamId: owner.teamId,
    position: {
      x: owner.position.x + direction.x * offset,
      y: owner.position.y + direction.y * offset,
    },
    velocity: {
      x: direction.x * config.projectileSpeed,
      y: direction.y * config.projectileSpeed,
    },
    damage: config.projectileDamage,
    radius: config.projectileRadius,
    remainingLifetimeMs: config.projectileLifetimeMs,
    remainingRange: config.projectileSpeed *
      config.projectileLifetimeMs / 1000,
    lifeState: "active",
  };
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
