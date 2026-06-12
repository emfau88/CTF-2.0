import {
  applyDamage,
  V2_ACTOR_LIFECYCLE_CONFIG,
  type ActorState,
  type WorldPosition,
} from "../actors";
import type { GameEvent } from "../events";
import type { CoreInputFrame } from "../input";
import type { WorldRect, WorldState } from "../world";
import type { ProjectileState } from "./projectile";
import {
  V2_V1_WEAPON_PARITY_CONFIG,
  type V1WeaponConfig,
} from "./V1WeaponConfig";

type V1WeaponId = "rocket" | "rail" | "whip";

export function fireV1Weapons(
  world: WorldState,
  actor: ActorState,
  input: CoreInputFrame,
  config: V1WeaponConfig = V2_V1_WEAPON_PARITY_CONFIG,
): readonly GameEvent[] {
  const request = input.actions.find((intent) =>
    intent.action === "fireWeapon" &&
    intent.phase === "pressed" &&
    (!intent.actorId || intent.actorId === actor.id)
  );
  const weaponId = readWeaponId(request?.payload);
  const direction = normalizedDirection(
    request?.direction ?? readAimDirection(input) ?? actor.lastMoveDirection,
  );
  if (!weaponId || !direction || actor.lifeState !== "active") {
    return [];
  }
  if (weaponId === "rocket") {
    return fireRocket(world, actor, direction, config);
  }
  if (weaponId === "rail") {
    return fireRail(world, actor, direction, config);
  }
  return fireWhip(world, actor, direction, config);
}

function fireRocket(
  world: WorldState,
  actor: ActorState,
  direction: WorldPosition,
  config: V1WeaponConfig,
): readonly GameEvent[] {
  if (actor.weapons.rocketAmmo <= 0) {
    return [];
  }
  actor.weapons.rocketAmmo--;
  const offset = actor.radius + config.rocketRadius + 3;
  const projectile: ProjectileState = {
    id: `rocket-${actor.id}-${actor.lifeId}-${world.timeMs}`,
    ownerActorId: actor.id,
    teamId: actor.teamId,
    weaponId: "rocket",
    position: {
      x: actor.position.x + direction.x * offset,
      y: actor.position.y + direction.y * offset,
    },
    velocity: {
      x: direction.x * config.rocketSpeed,
      y: direction.y * config.rocketSpeed,
    },
    damage: config.rocketDamage,
    radius: config.rocketRadius,
    splashRadius: config.rocketSplashRadius,
    knockback: config.rocketKnockback,
    remainingLifetimeMs: config.projectileLifetimeMs,
    remainingRange: config.rocketSpeed * config.projectileLifetimeMs / 1000,
    lifeState: "active",
  };
  world.projectiles.push(projectile);
  return [{
    id: `weapon-rocket-fired-${projectile.id}`,
    type: "weapon.rocketFired",
    timeMs: world.timeMs,
    sourceActorId: actor.id,
    teamId: actor.teamId ?? undefined,
    payload: {
      projectileId: projectile.id,
      position: { ...projectile.position },
      direction,
      remainingAmmo: actor.weapons.rocketAmmo,
    },
  }, {
    id: `projectile-spawned-${projectile.id}`,
    type: "projectile.spawned",
    timeMs: world.timeMs,
    sourceActorId: actor.id,
    teamId: actor.teamId ?? undefined,
    payload: {
      projectileId: projectile.id,
      weaponId: "rocket",
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
    },
  }];
}

function fireRail(
  world: WorldState,
  actor: ActorState,
  direction: WorldPosition,
  config: V1WeaponConfig,
): readonly GameEvent[] {
  if (
    actor.weapons.railAmmo <= 0 ||
    actor.weapons.railCooldownMs > 0
  ) {
    return [];
  }
  const start = {
    x: actor.position.x + direction.x * (actor.radius + 5),
    y: actor.position.y + direction.y * (actor.radius + 5),
  };
  let distance = config.railRange;
  for (const solid of world.geometry.solids) {
    distance = Math.min(
      distance,
      rayRectDistance(start, direction, solid) ?? distance,
    );
  }
  let target: ActorState | null = null;
  for (const candidate of world.actors) {
    if (!isEnemyTarget(actor, candidate)) {
      continue;
    }
    const targetDistance = rayCircleDistance(
      start,
      direction,
      candidate.position,
      candidate.radius + 5,
    );
    if (targetDistance !== null && targetDistance < distance) {
      distance = targetDistance;
      target = candidate;
    }
  }
  const end = {
    x: start.x + direction.x * distance,
    y: start.y + direction.y * distance,
  };
  actor.weapons.railAmmo--;
  actor.weapons.railCooldownMs = config.railCooldownMs;
  const events: GameEvent[] = [{
    id: `weapon-rail-fired-${actor.id}-${world.timeMs}`,
    type: "weapon.railFired",
    timeMs: world.timeMs,
    sourceActorId: actor.id,
    targetActorId: target?.id,
    teamId: actor.teamId ?? undefined,
    payload: {
      start,
      end,
      hit: Boolean(target),
      remainingAmmo: actor.weapons.railAmmo,
      cooldownMs: config.railCooldownMs,
    },
  }];
  if (target) {
    events.push(...applyDamage(
      target,
      target.maxHealth * config.railDamageRatio,
      world.timeMs,
      V2_ACTOR_LIFECYCLE_CONFIG,
      actor.id,
    ).events);
  }
  return events;
}

function fireWhip(
  world: WorldState,
  actor: ActorState,
  direction: WorldPosition,
  config: V1WeaponConfig,
): readonly GameEvent[] {
  if (
    actor.weapons.whipAmmo <= 0 ||
    actor.weapons.whipCooldownMs > 0
  ) {
    return [];
  }
  const minimumDot = Math.cos(config.whipHalfAngle);
  let target: ActorState | null = null;
  let bestDistance = Infinity;
  for (const candidate of world.actors) {
    if (!isEnemyTarget(actor, candidate)) {
      continue;
    }
    const dx = candidate.position.x - actor.position.x;
    const dy = candidate.position.y - actor.position.y;
    const distance = Math.hypot(dx, dy);
    if (
      distance > config.whipRange + candidate.radius ||
      distance >= bestDistance ||
      (dx * direction.x + dy * direction.y) / (distance || 1) < minimumDot ||
      world.geometry.solids.some((solid) =>
        lineIntersectsRect(actor.position, candidate.position, solid)
      )
    ) {
      continue;
    }
    target = candidate;
    bestDistance = distance;
  }
  actor.weapons.whipAmmo--;
  actor.weapons.whipCooldownMs = config.whipCooldownMs;
  const events: GameEvent[] = [{
    id: `weapon-whip-fired-${actor.id}-${world.timeMs}`,
    type: "weapon.whipFired",
    timeMs: world.timeMs,
    sourceActorId: actor.id,
    targetActorId: target?.id,
    teamId: actor.teamId ?? undefined,
    payload: {
      origin: { ...actor.position },
      direction,
      range: config.whipRange,
      halfAngle: config.whipHalfAngle,
      hit: Boolean(target),
      remainingAmmo: actor.weapons.whipAmmo,
      cooldownMs: config.whipCooldownMs,
    },
  }];
  if (target) {
    events.push(...applyDamage(
      target,
      config.whipDamage,
      world.timeMs,
      V2_ACTOR_LIFECYCLE_CONFIG,
      actor.id,
    ).events);
  }
  return events;
}

function isEnemyTarget(owner: ActorState, target: ActorState): boolean {
  return target.id !== owner.id &&
    target.lifeState === "active" &&
    Boolean(owner.teamId) &&
    Boolean(target.teamId) &&
    owner.teamId !== target.teamId;
}

function readWeaponId(payload: unknown): V1WeaponId | null {
  if (!payload || typeof payload !== "object" || !("weaponId" in payload)) {
    return null;
  }
  const weaponId = (payload as { weaponId?: unknown }).weaponId;
  return weaponId === "rocket" || weaponId === "rail" || weaponId === "whip"
    ? weaponId
    : null;
}

function readAimDirection(input: CoreInputFrame): WorldPosition | null {
  return input.actions.find((intent) => intent.action === "aim")
    ?.direction ?? null;
}

function normalizedDirection(direction: WorldPosition): WorldPosition | null {
  const length = Math.hypot(direction.x, direction.y);
  return length > .0001
    ? { x: direction.x / length, y: direction.y / length }
    : null;
}

function rayRectDistance(
  origin: WorldPosition,
  direction: WorldPosition,
  rect: WorldRect,
): number | null {
  let near = 0;
  let far = Infinity;
  for (const [value, delta, min, max] of [
    [origin.x, direction.x, rect.x, rect.x + rect.width],
    [origin.y, direction.y, rect.y, rect.y + rect.height],
  ] as const) {
    if (Math.abs(delta) < .0001) {
      if (value < min || value > max) {
        return null;
      }
      continue;
    }
    const first = (min - value) / delta;
    const second = (max - value) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) {
      return null;
    }
  }
  return far >= 0 ? Math.max(0, near) : null;
}

function rayCircleDistance(
  origin: WorldPosition,
  direction: WorldPosition,
  center: WorldPosition,
  radius: number,
): number | null {
  const dx = center.x - origin.x;
  const dy = center.y - origin.y;
  const projection = dx * direction.x + dy * direction.y;
  if (projection < 0) {
    return null;
  }
  const perpendicularSquared = dx * dx + dy * dy - projection * projection;
  const radiusSquared = radius * radius;
  if (perpendicularSquared > radiusSquared) {
    return null;
  }
  return projection - Math.sqrt(radiusSquared - perpendicularSquared);
}

function lineIntersectsRect(
  from: WorldPosition,
  to: WorldPosition,
  rect: WorldRect,
): boolean {
  const direction = { x: to.x - from.x, y: to.y - from.y };
  const distance = rayRectDistance(from, direction, rect);
  return distance !== null && distance <= 1;
}
