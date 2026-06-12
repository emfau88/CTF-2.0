import type { GameEvent } from "../events";
import type { ActorId, ActorState } from "./actor";
import type { ActorLifecycleConfig } from "./ActorLifecycleConfig";

export interface ActorDamageResult {
  readonly applied: boolean;
  readonly armorDamage: number;
  readonly healthDamage: number;
  readonly killed: boolean;
  readonly events: readonly GameEvent[];
}

export interface ActorLifecycleResult {
  readonly respawned: boolean;
  readonly events: readonly GameEvent[];
}

export function applyDamage(
  actor: ActorState,
  amount: number,
  timeMs: number,
  config: ActorLifecycleConfig,
  sourceActorId?: ActorId,
): ActorDamageResult {
  const damage = Math.max(0, amount);
  if (actor.lifeState !== "active" || damage <= 0) {
    return {
      applied: false,
      armorDamage: 0,
      healthDamage: 0,
      killed: false,
      events: [],
    };
  }

  const armorDamage = Math.min(actor.armor, damage);
  const healthDamage = Math.min(actor.health, damage - armorDamage);
  actor.armor -= armorDamage;
  actor.health = Math.max(0, actor.health - healthDamage);

  const events: GameEvent[] = [{
    id: `actor-damaged-${actor.id}-${timeMs}`,
    type: "actor.damaged",
    timeMs,
    sourceActorId,
    targetActorId: actor.id,
    teamId: actor.teamId ?? undefined,
    payload: {
      amount: damage,
      armorDamage,
      healthDamage,
      remainingArmor: actor.armor,
      remainingHealth: actor.health,
    },
  }];

  const killed = actor.health <= 0;
  if (killed) {
    actor.lifeState = "dead";
    actor.velocity.x = 0;
    actor.velocity.y = 0;
    actor.armor = 0;
    actor.respawn = {
      reason: "death",
      remainingMs: config.respawnDelayMs,
    };
    cancelJump(actor);
    events.push({
      id: `actor-died-${actor.id}-${timeMs}`,
      type: "actor.died",
      timeMs,
      sourceActorId,
      targetActorId: actor.id,
      teamId: actor.teamId ?? undefined,
      payload: {
        victimActorId: actor.id,
        victimLifeId: actor.lifeId,
        respawnDelayMs: config.respawnDelayMs,
      },
    });
  }

  return {
    applied: true,
    armorDamage,
    healthDamage,
    killed,
    events,
  };
}

export function updateActorLifecycle(
  actor: ActorState,
  deltaMs: number,
  timeMs: number,
  config: ActorLifecycleConfig,
): ActorLifecycleResult {
  if (
    (actor.lifeState !== "dead" && actor.lifeState !== "respawning") ||
    actor.respawn?.reason !== "death"
  ) {
    return { respawned: false, events: [] };
  }

  actor.respawn.remainingMs = Math.max(
    0,
    actor.respawn.remainingMs - Math.max(0, deltaMs),
  );
  if (actor.respawn.remainingMs > 0) {
    return { respawned: false, events: [] };
  }

  actor.position.x = actor.spawnPosition.x;
  actor.position.y = actor.spawnPosition.y;
  actor.lastSafePosition.x = actor.spawnPosition.x;
  actor.lastSafePosition.y = actor.spawnPosition.y;
  actor.velocity.x = 0;
  actor.velocity.y = 0;
  actor.health = actor.maxHealth;
  actor.armor = Math.min(actor.maxArmor, config.respawnArmor);
  actor.lifeId += 1;
  actor.lifeState = "active";
  actor.respawn = null;
  actor.overGap = false;
  actor.safePositionElapsedMs = 0;
  resetJump(actor);

  return {
    respawned: true,
    events: [{
      id: `actor-respawned-${actor.id}-${timeMs}`,
      type: "actor.respawned",
      timeMs,
      targetActorId: actor.id,
      teamId: actor.teamId ?? undefined,
      payload: {
        lifeId: actor.lifeId,
        position: { ...actor.position },
        health: actor.health,
        armor: actor.armor,
      },
    }],
  };
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
