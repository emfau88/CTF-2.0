import type {
  ActorState,
} from "../actors";
import type { CoreActionIntent } from "../input";
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
  distanceBetween,
  hasLineOfSight,
  TdmBotCombatController,
} from "./TdmBotCombatController";

export class TdmBotController {
  private jumpHeld = false;

  constructor(
    private readonly actorId: string,
    private readonly targetActorId: string,
    private readonly movement: BotMovementConfig =
      V2_BOT_MOVEMENT_CONFIG,
    private readonly navigator: BotNavigator = new GridBotNavigator(),
    private readonly combat: TdmBotCombatController =
      new TdmBotCombatController(),
  ) {}

  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[] {
    const actor = findActiveActor(snapshot, this.actorId);
    const target = findActiveActor(snapshot, this.targetActorId);
    if (!actor || !target || snapshot.match?.phase === "ended") {
      this.combat.reset();
      this.jumpHeld = false;
      return [this.stopIntent()];
    }

    const engagement = planEngagement(
      actor.position,
      target.position,
      hasLineOfSight(actor.position, target.position, snapshot.geometry.solids),
      crossesGap(
        actor.position,
        target.position,
        snapshot.geometry.gaps,
        this.movement.standoffMinRange * .5,
      ),
      this.movement,
    );
    const navigation = engagement.holdPosition
      ? {
        direction: { x: 0, y: 0 } as const,
        jump: false,
      }
      : this.navigator.navigate(
        actor.position,
        engagement.targetPosition,
        `${target.id}:${target.lifeId}:${engagement.key}`,
        snapshot,
        deltaMs,
      );
    const actions: CoreActionIntent[] = [{
      action: "move",
      phase: "held",
      actorId: actor.id,
      direction: navigation.direction,
      magnitude: engagement.holdPosition ? 0 : this.movement.inputMagnitude,
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

  reset(): void {
    this.navigator.reset();
    this.combat.reset();
    this.jumpHeld = false;
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

interface EngagementPlan {
  readonly holdPosition: boolean;
  readonly key: string;
  readonly targetPosition: ActorState["position"];
}

function findActiveActor(
  snapshot: WorldSnapshot,
  actorId: string,
): Readonly<ActorState> | null {
  return snapshot.actors.find((actor) =>
    actor.id === actorId && actor.lifeState === "active"
  ) ?? null;
}

function planEngagement(
  actor: ActorState["position"],
  target: ActorState["position"],
  lineOfSight: boolean,
  gapBetween: boolean,
  movement: BotMovementConfig,
): EngagementPlan {
  if (!lineOfSight || gapBetween) {
    return {
      holdPosition: false,
      key: "pursue",
      targetPosition: target,
    };
  }
  const distance = distanceBetween(actor, target);
  if (
    distance >= movement.standoffMinRange &&
    distance <= movement.standoffMaxRange
  ) {
    return {
      holdPosition: true,
      key: "hold",
      targetPosition: actor,
    };
  }
  const axis = directionBetween(actor, target);
  const fallbackAxis = axis.x === 0 && axis.y === 0 ? { x: -1, y: 0 } : axis;
  return {
    holdPosition: false,
    key: distance < movement.standoffMinRange ? "retreat" : "close",
    targetPosition: {
      x: target.x - fallbackAxis.x * movement.standoffDesiredRange,
      y: target.y - fallbackAxis.y * movement.standoffDesiredRange,
    },
  };
}

function crossesGap(
  from: ActorState["position"],
  to: ActorState["position"],
  gaps: readonly WorldRect[],
  padding: number,
): boolean {
  return gaps.some((gap) =>
    lineIntersectsRect(from, to, {
      ...gap,
      x: gap.x - padding,
      y: gap.y - padding,
      width: gap.width + padding * 2,
      height: gap.height + padding * 2,
    })
  );
}

function lineIntersectsRect(
  from: ActorState["position"],
  to: ActorState["position"],
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
