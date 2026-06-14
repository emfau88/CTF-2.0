import type {
  ActorState,
} from "../actors";
import type { CoreActionIntent } from "../input";
import type { WorldSnapshot } from "../world";
import {
  V2_BOT_MOVEMENT_CONFIG,
  type BotMovementConfig,
} from "./BotMovementConfig";
import {
  GridBotNavigator,
  type BotNavigator,
} from "./GridBotNavigator";
import { TdmBotCombatController } from "./TdmBotCombatController";

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

    const navigation = this.navigator.navigate(
      actor.position,
      target.position,
      `${target.id}:${target.lifeId}`,
      snapshot,
      deltaMs,
    );
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

function findActiveActor(
  snapshot: WorldSnapshot,
  actorId: string,
): Readonly<ActorState> | null {
  return snapshot.actors.find((actor) =>
    actor.id === actorId && actor.lifeState === "active"
  ) ?? null;
}

function directionBetween(
  from: ActorState["position"],
  to: ActorState["position"],
): ActorState["position"] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > .0001 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
}
