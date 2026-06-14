import type {
  ActorState,
  TeamId,
  WorldPosition,
} from "../actors";
import type { Objective } from "../objectives";
import type {
  WorldMapData,
  WorldMapPresentationRect,
  WorldSnapshot,
} from "../world";

export type OneFlagBotGoalKind =
  | "capture-flag"
  | "chase-enemy-carrier"
  | "escort-carrier"
  | "take-center-flag"
  | "control-mid";

export interface OneFlagBotGoal {
  readonly kind: OneFlagBotGoalKind;
  readonly position: WorldPosition;
  readonly targetKey: string;
}

export class OneFlagBotDecisionController {
  constructor(private readonly map: WorldMapData) {}

  chooseGoal(
    actor: Readonly<ActorState>,
    snapshot: WorldSnapshot,
  ): OneFlagBotGoal {
    const flag = neutralFlag(snapshot);
    const ownCarry = carriedFlagBy(snapshot, actor.id);
    if (ownCarry) {
      return goal(
        "capture-flag",
        centerOf(captureBaseFor(this.map, actor.teamId)),
        `capture:${ownCarry.id}:${actor.lifeId}`,
      );
    }

    const enemyCarrier = activeEnemyCarrier(snapshot, actor);
    if (enemyCarrier) {
      return goal(
        "chase-enemy-carrier",
        enemyCarrier.position,
        `chase:${enemyCarrier.id}:${enemyCarrier.lifeId}`,
      );
    }

    const alliedCarrier = activeAlliedCarrier(snapshot, actor);
    if (alliedCarrier) {
      return goal(
        "escort-carrier",
        escortPoint(
          alliedCarrier.position,
          centerOf(captureBaseFor(this.map, alliedCarrier.teamId)),
        ),
        `escort:${alliedCarrier.id}:${alliedCarrier.lifeId}`,
      );
    }

    if (flag?.state.status === "home") {
      return goal(
        "take-center-flag",
        flag.position,
        `pickup:${flag.id}`,
      );
    }

    return goal(
      "control-mid",
      centerOf(this.map.presentation.combatZone ?? boundsRect(this.map)),
      `mid:${this.map.id}`,
    );
  }

  reset(): void {}
}

function goal(
  kind: OneFlagBotGoalKind,
  position: WorldPosition,
  targetKey: string,
): OneFlagBotGoal {
  return {
    kind,
    position: { ...position },
    targetKey,
  };
}

function neutralFlag(
  snapshot: WorldSnapshot,
): Readonly<Objective> | undefined {
  return snapshot.objectives.find((objective) => objective.kind === "neutral-flag");
}

function carriedFlagBy(
  snapshot: WorldSnapshot,
  actorId: string,
): Readonly<Objective> | undefined {
  return snapshot.objectives.find((objective) =>
    objective.kind === "neutral-flag" &&
    objective.state.status === "carried" &&
    objective.state.interactingActorId === actorId
  );
}

function activeEnemyCarrier(
  snapshot: WorldSnapshot,
  actor: Readonly<ActorState>,
): Readonly<ActorState> | null {
  const carrierId = neutralFlag(snapshot)?.state.interactingActorId;
  if (!carrierId) return null;
  const carrier = activeActor(snapshot, carrierId);
  return carrier && carrier.teamId !== actor.teamId ? carrier : null;
}

function activeAlliedCarrier(
  snapshot: WorldSnapshot,
  actor: Readonly<ActorState>,
): Readonly<ActorState> | null {
  const carrierId = neutralFlag(snapshot)?.state.interactingActorId;
  if (!carrierId || carrierId === actor.id) return null;
  const carrier = activeActor(snapshot, carrierId);
  return carrier && carrier.teamId === actor.teamId ? carrier : null;
}

function activeActor(
  snapshot: WorldSnapshot,
  actorId: string | null | undefined,
): Readonly<ActorState> | null {
  if (!actorId) return null;
  return snapshot.actors.find((actor) =>
    actor.id === actorId && actor.lifeState === "active"
  ) ?? null;
}

function captureBaseFor(
  map: WorldMapData,
  teamId: TeamId | null,
): WorldMapPresentationRect {
  return teamId === "red"
    ? map.presentation.blueBase
    : map.presentation.redBase;
}

function escortPoint(
  carrier: WorldPosition,
  captureBase: WorldPosition,
): WorldPosition {
  return {
    x: carrier.x + (captureBase.x - carrier.x) * .3,
    y: carrier.y + (captureBase.y - carrier.y) * .3,
  };
}

function boundsRect(map: WorldMapData): WorldMapPresentationRect {
  const bounds = map.geometry.bounds;
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function centerOf(rect: WorldMapPresentationRect): WorldPosition {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}
