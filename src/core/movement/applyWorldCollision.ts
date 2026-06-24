import type { ActorState, WorldPosition } from "../actors";
import type { GameEvent } from "../events";
import type { WorldGeometry, WorldRect } from "../world";
import type {
  CollisionConfig,
  WorldCollisionResult,
} from "./collisionTypes";

export function applyWorldCollision(
  actor: ActorState,
  geometry: WorldGeometry,
  deltaMs: number,
  timeMs: number,
  config: CollisionConfig,
): WorldCollisionResult {
  const ms = Math.min(Math.max(0, deltaMs), config.maxDeltaMs);
  const events: GameEvent[] = [];

  if (actor.lifeState === "falling") {
    const died = updateFalling(actor, ms, config);
    if (died) {
      events.push({
        id: `actor-died-fall-${actor.id}-${actor.lifeId}-${timeMs}`,
        type: "actor.died",
        timeMs,
        targetActorId: actor.id,
        teamId: actor.teamId ?? undefined,
        payload: {
          victimActorId: actor.id,
          victimLifeId: actor.lifeId,
          respawnDelayMs: actor.respawn?.remainingMs ?? 0,
          reason: "fall",
        },
      });
    }
    return { collided: false, fell: false, respawned: false, events };
  }

  clampToWorldBounds(actor, geometry);
  const collided = actor.jump.height <= config.solidClearHeight
    ? resolveSolidCollisions(actor, geometry.solids, config)
    : false;
  const dangerZones = geometry.gaps.map((gap) =>
    insetRect(gap, config.gapDangerInsetRatio)
  );

  actor.overGap = dangerZones.some((gap) =>
    circleIntersectsRect(
      actor.position,
      actor.radius * config.gapOverlapRadiusRatio,
      gap,
    )
  );

  const insideGap = dangerZones.some((gap) =>
    pointInRect(actor.position, gap)
  );
  const clearsGap =
    actor.jump.active && actor.jump.height >= config.gapClearHeight;
  if (insideGap && !clearsGap) {
    startFalling(actor, config);
    events.push({
      id: `actor-fell-${actor.id}-${timeMs}`,
      type: "actor.fell",
      timeMs,
      sourceActorId: actor.id,
      teamId: actor.teamId ?? undefined,
      payload: {
        position: { ...actor.position },
        lastSafePosition: { ...actor.lastSafePosition },
      },
    });
    return { collided, fell: true, respawned: false, events };
  }

  actor.safePositionElapsedMs += ms;
  if (
    actor.safePositionElapsedMs >= config.safePositionIntervalMs &&
    actor.jump.grounded &&
    !actor.overGap
  ) {
    actor.safePositionElapsedMs = 0;
    actor.lastSafePosition.x = actor.position.x;
    actor.lastSafePosition.y = actor.position.y;
  }

  return { collided, fell: false, respawned: false, events };
}

function clampToWorldBounds(
  actor: ActorState,
  geometry: WorldGeometry,
): void {
  actor.position.x = clamp(
    actor.position.x,
    geometry.bounds.minX + actor.radius,
    geometry.bounds.maxX - actor.radius,
  );
  actor.position.y = clamp(
    actor.position.y,
    geometry.bounds.minY + actor.radius,
    geometry.bounds.maxY - actor.radius,
  );
}

function resolveSolidCollisions(
  actor: ActorState,
  solids: readonly WorldRect[],
  config: CollisionConfig,
): boolean {
  let collided = false;

  for (let pass = 0; pass < config.collisionPasses; pass++) {
    let hitThisPass = false;
    for (const solid of solids) {
      const hit = resolveCircleRect(actor.position, actor.radius, solid);
      if (!hit) {
        continue;
      }
      actor.position.x += hit.x * (hit.depth + config.separationEpsilon);
      actor.position.y += hit.y * (hit.depth + config.separationEpsilon);
      const velocityIntoSurface =
        actor.velocity.x * hit.x + actor.velocity.y * hit.y;
      if (velocityIntoSurface < 0) {
        actor.velocity.x -= velocityIntoSurface * hit.x;
        actor.velocity.y -= velocityIntoSurface * hit.y;
      }
      hitThisPass = true;
      collided = true;
    }
    if (!hitThisPass) {
      break;
    }
  }
  return collided;
}

function startFalling(actor: ActorState, config: CollisionConfig): void {
  actor.lifeState = "falling";
  actor.respawn = {
    reason: "fall",
    remainingMs: config.fallDurationMs,
  };
  actor.velocity.x *= config.fallVelocityScale;
  actor.velocity.y *= config.fallVelocityScale;
  cancelJump(actor);
}

function updateFalling(
  actor: ActorState,
  deltaMs: number,
  config: CollisionConfig,
): boolean {
  if (!actor.respawn) {
    return false;
  }
  actor.respawn.remainingMs = Math.max(
    0,
    actor.respawn.remainingMs - deltaMs,
  );
  if (actor.respawn.remainingMs > 0) {
    return false;
  }

  actor.velocity.x = 0;
  actor.velocity.y = 0;
  actor.health = 0;
  actor.armor = 0;
  actor.weapons.rocketAmmo = 0;
  actor.weapons.rocketCooldownMs = 0;
  actor.weapons.railAmmo = 0;
  actor.weapons.railCooldownMs = 0;
  actor.weapons.whipAmmo = 0;
  actor.weapons.whipCooldownMs = 0;
  actor.lifeState = "dead";
  actor.respawn = {
    reason: "death",
    remainingMs: Math.max(0, config.respawnDelayMs - config.fallDurationMs),
  };
  return true;
}

function cancelJump(actor: ActorState): void {
  actor.jump.active = false;
  actor.jump.held = false;
  actor.jump.grounded = true;
  actor.jump.phase = "cooldown";
  actor.jump.elapsedMs = 0;
  actor.jump.height = 0;
}

function resetJump(actor: ActorState): void {
  cancelJump(actor);
  actor.jump.phase = "ready";
  actor.jump.cooldownRemainingMs = 0;
}

function insetRect(rect: WorldRect, ratio: number): WorldRect {
  const safeRatio = clamp(ratio, 0, .49);
  const insetX = rect.width * safeRatio;
  const insetY = rect.height * safeRatio;
  return {
    id: `${rect.id}-danger`,
    x: rect.x + insetX,
    y: rect.y + insetY,
    width: rect.width - insetX * 2,
    height: rect.height - insetY * 2,
  };
}

function pointInRect(point: WorldPosition, rect: WorldRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height;
}

function circleIntersectsRect(
  center: WorldPosition,
  radius: number,
  rect: WorldRect,
): boolean {
  const nearestX = clamp(center.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(center.y, rect.y, rect.y + rect.height);
  return (center.x - nearestX) ** 2 + (center.y - nearestY) ** 2 <
    radius ** 2;
}

function resolveCircleRect(
  position: WorldPosition,
  radius: number,
  rect: WorldRect,
): (WorldPosition & { depth: number }) | null {
  const nearestX = clamp(position.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(position.y, rect.y, rect.y + rect.height);
  let dx = position.x - nearestX;
  let dy = position.y - nearestY;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared >= radius * radius) {
    return null;
  }
  if (distanceSquared < .0001) {
    const left = Math.abs(position.x - rect.x);
    const right = Math.abs(rect.x + rect.width - position.x);
    const top = Math.abs(position.y - rect.y);
    const bottom = Math.abs(rect.y + rect.height - position.y);
    const nearestSide = Math.min(left, right, top, bottom);
    if (nearestSide === left) return { x: -1, y: 0, depth: radius + left };
    if (nearestSide === right) return { x: 1, y: 0, depth: radius + right };
    if (nearestSide === top) return { x: 0, y: -1, depth: radius + top };
    return { x: 0, y: 1, depth: radius + bottom };
  }

  const distance = Math.sqrt(distanceSquared);
  dx /= distance;
  dy /= distance;
  return { x: dx, y: dy, depth: radius - distance };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
