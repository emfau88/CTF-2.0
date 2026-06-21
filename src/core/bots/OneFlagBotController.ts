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
import { V2_BOT_NAVIGATION_CONFIG } from "./BotNavigationConfig";
import { planCombatStandoff } from "./BotCombatStandoff";
import {
  OneFlagBotDecisionController,
  type OneFlagBotGoal,
} from "./OneFlagBotDecisionController";
import { TdmBotCombatController } from "./TdmBotCombatController";

export interface OneFlagBotControllerDebugState {
  readonly actorId: string;
  readonly goalKind: OneFlagBotGoal["kind"] | null;
  readonly goalTarget: WorldPosition | null;
  readonly navigationTarget: WorldPosition | null;
  readonly navigationTargetKey: string;
  readonly projectionApplied: boolean;
  readonly projectionDistance: number;
  readonly combatTargetId: string | null;
  readonly standoffKey: string | null;
  readonly holdPosition: boolean;
}

export class OneFlagBotController {
  private jumpHeld = false;
  private readonly decision: OneFlagBotDecisionController;
  private lastDebugState: OneFlagBotControllerDebugState;

  constructor(
    private readonly actorId: string,
    map: WorldMapData,
    private readonly movement: BotMovementConfig = V2_BOT_MOVEMENT_CONFIG,
    private readonly navigator: BotNavigator = new GridBotNavigator(),
    private readonly combat: TdmBotCombatController =
      new TdmBotCombatController(),
  ) {
    this.decision = new OneFlagBotDecisionController(map);
    this.lastDebugState = createEmptyDebugState(actorId);
  }

  readActions(
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): readonly CoreActionIntent[] {
    const actor = findActiveActor(snapshot, this.actorId);
    if (!actor || snapshot.match?.phase === "ended") {
      this.resetTransientState();
      this.lastDebugState = createEmptyDebugState(this.actorId);
      return [this.stopIntent()];
    }

    const goal = this.decision.chooseGoal(actor, snapshot);
    const combatTarget = nearestActiveEnemy(snapshot, actor);
    const shouldApplyStandoff = combatTarget &&
      isCombatChaseGoal(goal.kind) &&
      positionsMatch(goal.position, combatTarget.position);
    const navigationTarget = shouldApplyStandoff
      ? planCombatStandoff(
        actor.position,
        combatTarget.position,
        snapshot,
        this.movement,
      )
      : null;
    const desiredTarget = navigationTarget?.targetPosition ?? goal.position;
    const shouldProjectDynamicTarget = shouldApplyStandoff ||
      goal.kind === "escort-carrier";
    const projectedTarget = shouldProjectDynamicTarget
      ? projectDynamicCarrierTarget(
        actor.position,
        desiredTarget,
        snapshot,
      )
      : desiredTarget;
    const projectionDistance = distanceBetweenPoints(
      desiredTarget,
      projectedTarget,
    );
    const navigation = navigationTarget?.holdPosition
      ? {
        direction: { x: 0, y: 0 } as const,
        jump: false,
      }
      : this.navigator.navigate(
        actor.position,
        projectedTarget,
        navigationTarget
          ? `${goal.targetKey}:${navigationTarget.key}`
          : goal.targetKey,
        snapshot,
        deltaMs,
      );
    this.lastDebugState = {
      actorId: actor.id,
      goalKind: goal.kind,
      goalTarget: { ...goal.position },
      navigationTarget: { ...projectedTarget },
      navigationTargetKey: navigationTarget
        ? `${goal.targetKey}:${navigationTarget.key}`
        : goal.targetKey,
      projectionApplied: projectionDistance > .001,
      projectionDistance,
      combatTargetId: combatTarget?.id ?? null,
      standoffKey: navigationTarget?.key ?? null,
      holdPosition: navigationTarget?.holdPosition ?? false,
    };
    const aimDirection = combatTarget
      ? directionBetween(actor.position, combatTarget.position)
      : directionBetween(actor.position, goal.position);
    const actions: CoreActionIntent[] = [{
      action: "move",
      phase: "held",
      actorId: actor.id,
      direction: navigation.direction,
      magnitude: navigationTarget?.holdPosition ? 0 : this.movement.inputMagnitude,
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
    this.lastDebugState = createEmptyDebugState(this.actorId);
  }

  debugSnapshot(): OneFlagBotControllerDebugState {
    return {
      ...this.lastDebugState,
      goalTarget: this.lastDebugState.goalTarget
        ? { ...this.lastDebugState.goalTarget }
        : null,
      navigationTarget: this.lastDebugState.navigationTarget
        ? { ...this.lastDebugState.navigationTarget }
        : null,
    };
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

function isCombatChaseGoal(kind: OneFlagBotGoal["kind"]): boolean {
  return kind === "chase-enemy-carrier";
}

function positionsMatch(left: WorldPosition, right: WorldPosition): boolean {
  return Math.abs(left.x - right.x) < .001 && Math.abs(left.y - right.y) < .001;
}

function projectDynamicCarrierTarget(
  actor: WorldPosition,
  desiredTarget: WorldPosition,
  snapshot: Pick<WorldSnapshot, "geometry">,
): WorldPosition {
  if (!blocked(desiredTarget, snapshot)) {
    return desiredTarget;
  }
  const fallbackAxis = normalizedDirection(desiredTarget, actor);
  const axes = [
    fallbackAxis,
    { x: -fallbackAxis.y, y: fallbackAxis.x },
    { x: fallbackAxis.y, y: -fallbackAxis.x },
  ];
  for (const axis of axes) {
    for (let distance = 16; distance <= 240; distance += 16) {
      const candidate = clampToBounds({
        x: desiredTarget.x + axis.x * distance,
        y: desiredTarget.y + axis.y * distance,
      }, snapshot);
      if (!blocked(candidate, snapshot)) {
        return candidate;
      }
    }
  }
  return desiredTarget;
}

function normalizedDirection(
  from: WorldPosition,
  to: WorldPosition,
): WorldPosition {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= .0001) {
    return { x: -1, y: 0 };
  }
  return { x: dx / length, y: dy / length };
}

function blocked(
  point: WorldPosition,
  snapshot: Pick<WorldSnapshot, "geometry">,
): boolean {
  return [...snapshot.geometry.solids, ...snapshot.geometry.gaps].some((rect) =>
    point.x >= rect.x - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
    point.x <= rect.x + rect.width + V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
    point.y >= rect.y - V2_BOT_NAVIGATION_CONFIG.obstaclePadding &&
    point.y <= rect.y + rect.height + V2_BOT_NAVIGATION_CONFIG.obstaclePadding
  );
}

function clampToBounds(
  point: WorldPosition,
  snapshot: Pick<WorldSnapshot, "geometry">,
): WorldPosition {
  return {
    x: Math.min(
      snapshot.geometry.bounds.maxX,
      Math.max(snapshot.geometry.bounds.minX, point.x),
    ),
    y: Math.min(
      snapshot.geometry.bounds.maxY,
      Math.max(snapshot.geometry.bounds.minY, point.y),
    ),
  };
}

function createEmptyDebugState(actorId: string): OneFlagBotControllerDebugState {
  return {
    actorId,
    goalKind: null,
    goalTarget: null,
    navigationTarget: null,
    navigationTargetKey: "",
    projectionApplied: false,
    projectionDistance: 0,
    combatTargetId: null,
    standoffKey: null,
    holdPosition: false,
  };
}

function distanceBetweenPoints(
  left: WorldPosition,
  right: WorldPosition,
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
