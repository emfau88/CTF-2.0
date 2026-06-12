import type { ActorState, WorldPosition } from "../actors";
import type { GameEvent } from "../events";
import type { DiagnosticWeaponConfig } from "./DiagnosticWeaponConfig";
import type { ProjectileState } from "./projectile";

export interface DiagnosticFireResult {
  readonly projectile: ProjectileState | null;
  readonly events: readonly GameEvent[];
}

export function fireDiagnosticProjectile(
  actor: ActorState,
  aim: WorldPosition,
  sequence: number,
  timeMs: number,
  config: DiagnosticWeaponConfig,
): DiagnosticFireResult {
  if (
    actor.lifeState !== "active" ||
    actor.primaryFireCooldownMs > 0
  ) {
    return { projectile: null, events: [] };
  }

  const direction = normalizedDirection(aim, actor.facing);
  const offset = actor.radius + config.projectileRadius + config.muzzleOffset;
  const projectile: ProjectileState = {
    id: `diagnostic-projectile-${sequence}-${actor.id}`,
      ownerActorId: actor.id,
      teamId: actor.teamId,
      weaponId: "diagnostic-blaster",
    position: {
      x: actor.position.x + direction.x * offset,
      y: actor.position.y + direction.y * offset,
    },
    velocity: {
      x: direction.x * config.projectileSpeed,
      y: direction.y * config.projectileSpeed,
    },
    damage: config.projectileDamage,
    radius: config.projectileRadius,
    remainingLifetimeMs: config.projectileLifetimeMs,
    remainingRange: config.projectileRange,
    lifeState: "active",
  };
  actor.primaryFireCooldownMs = config.cooldownMs;

  return {
    projectile,
    events: [{
      id: `projectile-spawned-${projectile.id}`,
      type: "projectile.spawned",
      timeMs,
      sourceActorId: actor.id,
      teamId: actor.teamId ?? undefined,
      payload: {
        projectileId: projectile.id,
        position: { ...projectile.position },
        velocity: { ...projectile.velocity },
      },
    }],
  };
}

function normalizedDirection(
  requested: WorldPosition,
  fallback: WorldPosition,
): WorldPosition {
  const requestedLength = Math.hypot(requested.x, requested.y);
  if (requestedLength > .0001) {
    return {
      x: requested.x / requestedLength,
      y: requested.y / requestedLength,
    };
  }
  const fallbackLength = Math.hypot(fallback.x, fallback.y);
  if (fallbackLength > .0001) {
    return {
      x: fallback.x / fallbackLength,
      y: fallback.y / fallbackLength,
    };
  }
  return { x: 1, y: 0 };
}
