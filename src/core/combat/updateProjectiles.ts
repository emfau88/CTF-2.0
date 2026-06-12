import {
  applyDamage,
  type ActorLifecycleConfig,
  type ActorState,
} from "../actors";
import type { GameEvent } from "../events";
import type { WorldGeometry, WorldRect } from "../world";
import type { DiagnosticWeaponConfig } from "./DiagnosticWeaponConfig";
import type { ProjectileState } from "./projectile";

export interface ProjectileUpdateResult {
  readonly events: readonly GameEvent[];
}

export function updateProjectiles(
  projectiles: ProjectileState[],
  actors: ActorState[],
  geometry: WorldGeometry,
  deltaMs: number,
  timeMs: number,
  weaponConfig: DiagnosticWeaponConfig,
  lifecycleConfig: ActorLifecycleConfig,
): ProjectileUpdateResult {
  const events: GameEvent[] = [];
  const ms = Math.min(Math.max(0, deltaMs), weaponConfig.maxDeltaMs);
  const dt = ms / 1000;

  for (const projectile of projectiles) {
    if (projectile.lifeState !== "active") {
      continue;
    }

    const distance = Math.hypot(projectile.velocity.x, projectile.velocity.y) *
      dt;
    projectile.position.x += projectile.velocity.x * dt;
    projectile.position.y += projectile.velocity.y * dt;
    projectile.remainingLifetimeMs = Math.max(
      0,
      projectile.remainingLifetimeMs - ms,
    );
    projectile.remainingRange = Math.max(
      0,
      projectile.remainingRange - distance,
    );

    const hitSolid = geometry.solids.some((solid) =>
      circleIntersectsRect(projectile, solid)
    );
    const outsideBounds =
      projectile.position.x - projectile.radius < geometry.bounds.minX ||
      projectile.position.x + projectile.radius > geometry.bounds.maxX ||
      projectile.position.y - projectile.radius < geometry.bounds.minY ||
      projectile.position.y + projectile.radius > geometry.bounds.maxY;
    if (hitSolid || outsideBounds) {
      if (projectile.weaponId === "rocket") {
        explodeRocket(projectile, actors, geometry, timeMs, events, lifecycleConfig);
      }
      expireProjectile(projectile, timeMs, events, hitSolid ? "solid" : "bounds");
      continue;
    }

    const target = actors.find((actor) =>
      actor.id !== projectile.ownerActorId &&
      actor.lifeState === "active" &&
      (projectile.teamId === null || actor.teamId !== projectile.teamId) &&
      circlesOverlap(projectile, actor)
    );
    if (target) {
      projectile.lifeState = "hit";
      events.push({
        id: `projectile-hit-${projectile.id}-${timeMs}`,
        type: "projectile.hit",
        timeMs,
        sourceActorId: projectile.ownerActorId,
        targetActorId: target.id,
        teamId: projectile.teamId ?? undefined,
        payload: {
          projectileId: projectile.id,
          weaponId: projectile.weaponId,
          position: { ...projectile.position },
          damage: projectile.damage,
        },
      });
      if (projectile.weaponId === "rocket") {
        explodeRocket(
          projectile,
          actors,
          geometry,
          timeMs,
          events,
          lifecycleConfig,
        );
      } else {
        const damage = applyDamage(
          target,
          projectile.damage,
          timeMs,
          lifecycleConfig,
          projectile.ownerActorId,
        );
        events.push(...damage.events);
      }
      continue;
    }

    if (
      projectile.remainingLifetimeMs <= 0 ||
      projectile.remainingRange <= 0
    ) {
      expireProjectile(
        projectile,
        timeMs,
        events,
        projectile.remainingLifetimeMs <= 0 ? "lifetime" : "range",
      );
    }
  }

  for (let index = projectiles.length - 1; index >= 0; index--) {
    if (projectiles[index]?.lifeState !== "active") {
      projectiles.splice(index, 1);
    }
  }

  return { events };
}

function expireProjectile(
  projectile: ProjectileState,
  timeMs: number,
  events: GameEvent[],
  reason: string,
): void {
  projectile.lifeState = "expired";
  events.push({
    id: `projectile-expired-${projectile.id}-${timeMs}`,
    type: "projectile.expired",
    timeMs,
    sourceActorId: projectile.ownerActorId,
    teamId: projectile.teamId ?? undefined,
    payload: {
      projectileId: projectile.id,
      weaponId: projectile.weaponId,
      position: { ...projectile.position },
      reason,
    },
  });
}

function explodeRocket(
  projectile: ProjectileState,
  actors: ActorState[],
  geometry: WorldGeometry,
  timeMs: number,
  events: GameEvent[],
  lifecycleConfig: ActorLifecycleConfig,
): void {
  const splashRadius = projectile.splashRadius ?? 0;
  const knockback = projectile.knockback ?? 0;
  events.push({
    id: `weapon-rocket-exploded-${projectile.id}-${timeMs}`,
    type: "weapon.rocketExploded",
    timeMs,
    sourceActorId: projectile.ownerActorId,
    teamId: projectile.teamId ?? undefined,
    payload: {
      projectileId: projectile.id,
      position: { ...projectile.position },
      splashRadius,
    },
  });
  for (const actor of actors) {
    if (
      actor.lifeState !== "active" ||
      actor.teamId === projectile.teamId
    ) {
      continue;
    }
    const dx = actor.position.x - projectile.position.x;
    const dy = actor.position.y - projectile.position.y;
    const distance = Math.hypot(dx, dy);
    if (
      distance > splashRadius + actor.radius ||
      geometry.solids.some((solid) =>
        lineIntersectsRect(projectile.position, actor.position, solid)
      )
    ) {
      continue;
    }
    const falloff = clamp(1 - distance / splashRadius, .35, 1);
    events.push(...applyDamage(
      actor,
      projectile.damage * falloff,
      timeMs,
      lifecycleConfig,
      projectile.ownerActorId,
    ).events);
    const normal = distance || 1;
    actor.velocity.x += dx / normal * knockback * falloff;
    actor.velocity.y += dy / normal * knockback * falloff;
    actor.position.x += dx / normal * 18 * falloff;
    actor.position.y += dy / normal * 18 * falloff;
  }
}

function lineIntersectsRect(
  from: { x: number; y: number },
  to: { x: number; y: number },
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

function circleIntersectsRect(
  circle: Pick<ProjectileState, "position" | "radius">,
  rect: WorldRect,
): boolean {
  const nearestX = clamp(circle.position.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.position.y, rect.y, rect.y + rect.height);
  return (circle.position.x - nearestX) ** 2 +
      (circle.position.y - nearestY) ** 2 <
    circle.radius ** 2;
}

function circlesOverlap(
  projectile: ProjectileState,
  actor: ActorState,
): boolean {
  const radius = projectile.radius + actor.radius;
  return (projectile.position.x - actor.position.x) ** 2 +
      (projectile.position.y - actor.position.y) ** 2 <=
    radius ** 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
