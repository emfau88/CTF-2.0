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
          position: { ...projectile.position },
          damage: projectile.damage,
        },
      });
      const damage = applyDamage(
        target,
        projectile.damage,
        timeMs,
        lifecycleConfig,
        projectile.ownerActorId,
      );
      events.push(...damage.events);
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
      position: { ...projectile.position },
      reason,
    },
  });
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
