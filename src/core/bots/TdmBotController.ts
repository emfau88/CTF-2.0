import type {
  ActorState,
} from "../actors";
import type { CoreActionIntent } from "../input";
import type { PickupState } from "../pickups";
import type { ArenaTeamSlot } from "../spawning";
import type { WorldRect, WorldSnapshot } from "../world";
import {
  V2_BOT_MOVEMENT_CONFIG,
  type BotMovementConfig,
} from "./BotMovementConfig";
import {
  GridBotNavigator,
  type BotNavigator,
} from "./GridBotNavigator";
import {
  directionBetween,
  TdmBotCombatController,
} from "./TdmBotCombatController";
import { planCombatStandoff } from "./BotCombatStandoff";

export type TdmBotIntent =
  | "fight-enemy"
  | "hold-standoff"
  | "seek-armor"
  | "seek-health"
  | "seek-weapon"
  | "idle";

export interface TdmBotControllerDebugState {
  readonly actorId: string;
  readonly intent: TdmBotIntent;
  readonly targetActorId: string | null;
  readonly pickupId: string | null;
  readonly navigationTargetKey: string;
  readonly standoffKey: string | null;
  readonly holdPosition: boolean;
}

const PICKUP_TARGET_STICKINESS_MS = 850;

export class TdmBotController {
  private jumpHeld = false;
  private stickyPickupId: string | null = null;
  private stickyPickupRemainingMs = 0;
  private lastDebugState: TdmBotControllerDebugState;

  constructor(
    private readonly actorId: string,
    private readonly targetActorId?: string,
    private readonly movement: BotMovementConfig =
      V2_BOT_MOVEMENT_CONFIG,
    private readonly navigator: BotNavigator = new GridBotNavigator(),
    private readonly combat: TdmBotCombatController =
      new TdmBotCombatController(),
    private readonly slot: ArenaTeamSlot = 1,
  ) {
    this.lastDebugState = createEmptyDebugState(actorId);
  }

  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[] {
    const actor = findActiveActor(snapshot, this.actorId);
    const requestedTarget = this.targetActorId
      ? findActiveActor(snapshot, this.targetActorId)
      : null;
    const target = actor
      ? requestedTarget ?? nearestActiveEnemy(snapshot, actor)
      : null;
    if (!actor || !target || snapshot.match?.phase === "ended") {
      this.combat.reset();
      this.jumpHeld = false;
      this.stickyPickupId = null;
      this.stickyPickupRemainingMs = 0;
      this.lastDebugState = createEmptyDebugState(this.actorId);
      return [this.stopIntent()];
    }

    this.stickyPickupRemainingMs = Math.max(
      0,
      this.stickyPickupRemainingMs - Math.max(0, deltaMs),
    );
    const enemyDistance = distance(actor.position, target.position);
    const pickup = selectPickupGoal(
      snapshot,
      actor,
      this.slot,
      enemyDistance,
      this.stickyPickupRemainingMs > 0 ? this.stickyPickupId : null,
    );
    if (pickup) {
      this.stickyPickupId = pickup.id;
      this.stickyPickupRemainingMs = PICKUP_TARGET_STICKINESS_MS;
    } else {
      this.stickyPickupId = null;
      this.stickyPickupRemainingMs = 0;
    }
    const engagement = planCombatStandoff(
      actor.position,
      target.position,
      snapshot,
      this.movement,
    );
    const navigationTarget = pickup?.position ?? laneBiasedTarget(
      snapshot,
      actor,
      target,
      this.slot,
      engagement.targetPosition,
    );
    const holdPosition = !pickup && engagement.holdPosition;
    const navigationTargetKey = pickup
      ? `pickup:${pickup.id}`
      : `${target.id}:${target.lifeId}:${engagement.key}:lane-${this.slot}`;
    const navigation = holdPosition
      ? {
        direction: { x: 0, y: 0 } as const,
        jump: false,
      }
      : this.navigator.navigate(
        actor.position,
        navigationTarget,
        navigationTargetKey,
        snapshot,
        deltaMs,
      );
    this.lastDebugState = {
      actorId: actor.id,
      intent: pickup
        ? intentForPickup(pickup)
        : holdPosition
        ? "hold-standoff"
        : "fight-enemy",
      targetActorId: target.id,
      pickupId: pickup?.id ?? null,
      navigationTargetKey,
      standoffKey: pickup ? null : engagement.key,
      holdPosition,
    };
    const actions: CoreActionIntent[] = [{
      action: "move",
      phase: "held",
      actorId: actor.id,
      direction: navigation.direction,
      magnitude: holdPosition ? 0 : this.movement.inputMagnitude,
    }, {
      action: "aim",
      phase: "held",
      actorId: actor.id,
      direction: directionBetween(actor.position, target.position),
    }];
    const weaponAction = this.combat.readAction(
      actor,
      target,
      snapshot,
      deltaMs,
    );
    if (weaponAction) {
      actions.push(weaponAction);
    }
    if (navigation.jump) {
      if (
        !this.jumpHeld &&
        actor.jump.grounded &&
        actor.jump.cooldownRemainingMs <= 0
      ) {
        actions.push({
          action: "jump",
          phase: "pressed",
          actorId: actor.id,
        });
      }
      actions.push({
        action: "jump",
        phase: "held",
        actorId: actor.id,
      });
      this.jumpHeld = true;
    } else if (this.jumpHeld) {
      actions.push({
        action: "jump",
        phase: "released",
        actorId: actor.id,
      });
      this.jumpHeld = false;
    }
    return actions;
  }

  debugSnapshot(): TdmBotControllerDebugState {
    return { ...this.lastDebugState };
  }

  reset(): void {
    this.navigator.reset();
    this.combat.reset();
    this.jumpHeld = false;
    this.stickyPickupId = null;
    this.stickyPickupRemainingMs = 0;
    this.lastDebugState = createEmptyDebugState(this.actorId);
  }

  private stopIntent(): CoreActionIntent {
    return {
      action: "move",
      phase: "held",
      actorId: this.actorId,
      direction: { x: 0, y: 0 },
      magnitude: 0,
    };
  }
}

function selectPickupGoal(
  snapshot: WorldSnapshot,
  actor: Readonly<ActorState>,
  slot: ArenaTeamSlot,
  enemyDistance: number,
  preferredPickupId: string | null,
): Readonly<PickupState> | null {
  const active = snapshot.pickups.filter((pickup) => pickup.lifeState === "active");
  const urgentType = actor.health <= actor.maxHealth * .55
    ? "health"
    : slot === 4 && actor.armor <= actor.maxArmor * .5
    ? "armor"
    : null;
  const preferredWeapon = preferredWeaponForSlot(slot);
  const needsPreferredWeapon = preferredWeapon === null
    ? false
    : preferredWeapon === "rocket"
    ? actor.weapons.rocketAmmo <= 0
    : preferredWeapon === "rail"
    ? actor.weapons.railAmmo <= 0
    : actor.weapons.whipAmmo <= 0;
  const desiredTypes = [
    urgentType,
    needsPreferredWeapon ? preferredWeapon : null,
  ].filter((type): type is PickupState["type"] => type !== null);
  if (desiredTypes.length === 0) {
    return null;
  }
  if (
    !preferredPickupId &&
    enemyDistance < 230 &&
    actor.health > 25
  ) {
    return null;
  }
  const candidates = active
    .filter((pickup) => desiredTypes.includes(pickup.type))
    .map((pickup) => ({
      pickup,
      distance: distance(actor.position, pickup.position),
    }))
    .filter((candidate) => candidate.distance <= 720)
    .sort((left, right) =>
      left.distance - right.distance || left.pickup.id.localeCompare(right.pickup.id)
    );
  return candidates.find((candidate) =>
    candidate.pickup.id === preferredPickupId
  )?.pickup ?? candidates[0]?.pickup ?? null;
}

function preferredWeaponForSlot(
  slot: ArenaTeamSlot,
): "rocket" | "rail" | "whip" | null {
  if (slot === 1) return "rocket";
  if (slot === 2) return "rail";
  if (slot === 3) return "whip";
  return null;
}

function intentForPickup(pickup: Readonly<PickupState>): TdmBotIntent {
  if (pickup.type === "health") return "seek-health";
  if (pickup.type === "armor") return "seek-armor";
  return "seek-weapon";
}

function createEmptyDebugState(actorId: string): TdmBotControllerDebugState {
  return {
    actorId,
    intent: "idle",
    targetActorId: null,
    pickupId: null,
    navigationTargetKey: "",
    standoffKey: null,
    holdPosition: false,
  };
}

function laneBiasedTarget(
  snapshot: WorldSnapshot,
  actor: Readonly<ActorState>,
  target: Readonly<ActorState>,
  slot: ArenaTeamSlot,
  fallback: Readonly<{ x: number; y: number }>,
): { x: number; y: number } {
  if (Math.abs(target.position.x - actor.position.x) < 340) {
    return { ...fallback };
  }
  const bounds = snapshot.geometry.bounds;
  const ratio = slot === 2
    ? .24
    : slot === 3
    ? .76
    : slot === 4
    ? actor.teamId === "blue" ? .38 : .62
    : .5;
  return {
    x: fallback.x,
    y: bounds.minY + (bounds.maxY - bounds.minY) * ratio,
  };
}

function distance(
  left: Readonly<{ x: number; y: number }>,
  right: Readonly<{ x: number; y: number }>,
): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function nearestActiveEnemy(
  snapshot: WorldSnapshot,
  actor: Readonly<ActorState>,
): Readonly<ActorState> | null {
  let nearest: Readonly<ActorState> | null = null;
  let nearestDistance = Infinity;
  for (const candidate of snapshot.actors) {
    if (
      candidate.lifeState !== "active" ||
      !candidate.teamId ||
      candidate.teamId === actor.teamId
    ) {
      continue;
    }
    const distance = Math.hypot(
      candidate.position.x - actor.position.x,
      candidate.position.y - actor.position.y,
    );
    if (
      distance < nearestDistance ||
      (distance === nearestDistance &&
        (!nearest || candidate.id.localeCompare(nearest.id) < 0))
    ) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function findActiveActor(
  snapshot: WorldSnapshot,
  actorId: string,
): Readonly<ActorState> | null {
  return snapshot.actors.find((actor) =>
    actor.id === actorId && actor.lifeState === "active"
  ) ?? null;
}
