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

export class TdmBotController {
  constructor(
    private readonly actorId: string,
    private readonly targetActorId: string,
    private readonly movement: BotMovementConfig =
      V2_BOT_MOVEMENT_CONFIG,
    private readonly navigator: BotNavigator = new GridBotNavigator(),
  ) {}

  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[] {
    const actor = findActiveActor(snapshot, this.actorId);
    const target = findActiveActor(snapshot, this.targetActorId);
    if (!actor || !target || snapshot.match?.phase === "ended") {
      return [this.stopIntent()];
    }

    const direction = this.navigator.directionTo(
      actor.position,
      target.position,
      `${target.id}:${target.lifeId}`,
      snapshot,
      deltaMs,
    );
    return [{
      action: "move",
      phase: "held",
      actorId: actor.id,
      direction,
      magnitude: this.movement.inputMagnitude,
    }, {
      action: "aim",
      phase: "held",
      actorId: actor.id,
      direction: directionBetween(actor.position, target.position),
    }];
  }

  reset(): void {
    this.navigator.reset();
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
