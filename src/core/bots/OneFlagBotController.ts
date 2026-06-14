import type { ActorState, WorldPosition } from "../actors";
import type { CoreActionIntent } from "../input";
import type { WorldMapData, WorldSnapshot } from "../world";
import {
  V2_BOT_MOVEMENT_CONFIG,
  type BotMovementConfig,
} from "./BotMovementConfig";
import {
  GridBotNavigator,
  type BotNavigator,
} from "./GridBotNavigator";
import {
  OneFlagBotDecisionController,
} from "./OneFlagBotDecisionController";
import { TdmBotCombatController } from "./TdmBotCombatController";

export class OneFlagBotController {
  private jumpHeld = false;
  private readonly decision: OneFlagBotDecisionController;

  constructor(
    private readonly actorId: string,
    map: WorldMapData,
    private readonly movement: BotMovementConfig = V2_BOT_MOVEMENT_CONFIG,
    private readonly navigator: BotNavigator = new GridBotNavigator(),
    private readonly combat: TdmBotCombatController =
      new TdmBotCombatController(),
  ) {
    this.decision = new OneFlagBotDecisionController(map);
  }

  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[] {
    const actor = findActiveActor(snapshot, this.actorId);
    if (!actor || snapshot.match?.phase === "ended") {
      this.resetTransientState();
      return [this.stopIntent()];
    }

    const goal = this.decision.chooseGoal(actor, snapshot);
    const navigation = this.navigator.navigate(
      actor.position,
      goal.position,
      goal.targetKey,
      snapshot,
      deltaMs,
    );
    const combatTarget = nearestActiveEnemy(snapshot, actor);
    const aimDirection = combatTarget
      ? directionBetween(actor.position, combatTarget.position)
      : directionBetween(actor.position, goal.position);
    const actions: CoreActionIntent[] = [{
      action: "move",
      phase: "held",
      actorId: actor.id,
      direction: navigation.direction,
      magnitude: this.movement.inputMagnitude,
    }, {
      action: "aim",
      phase: "held",
      actorId: actor.id,
      direction: aimDirection,
    }];
    if (combatTarget) {
      const weaponAction = this.combat.readAction(
        actor,
        combatTarget,
        snapshot,
        deltaMs,
      );
      if (weaponAction) actions.push(weaponAction);
    }
    this.appendJumpActions(actions, actor, navigation.jump);
    return actions;
  }

  reset(): void {
    this.navigator.reset();
    this.decision.reset();
    this.resetTransientState();
  }

  private resetTransientState(): void {
    this.combat.reset();
    this.jumpHeld = false;
  }

  private appendJumpActions(
    actions: CoreActionIntent[],
    actor: Readonly<ActorState>,
    jump: boolean,
  ): void {
    if (jump) {
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

function findActiveActor(
  snapshot: WorldSnapshot,
  actorId: string,
): Readonly<ActorState> | null {
  return snapshot.actors.find((actor) =>
    actor.id === actorId && actor.lifeState === "active"
  ) ?? null;
}

function nearestActiveEnemy(
  snapshot: WorldSnapshot,
  actor: Readonly<ActorState>,
): Readonly<ActorState> | null {
  let best: Readonly<ActorState> | null = null;
  let bestDistance = Infinity;
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
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function directionBetween(
  from: WorldPosition,
  to: WorldPosition,
): WorldPosition {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > .0001 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
}
