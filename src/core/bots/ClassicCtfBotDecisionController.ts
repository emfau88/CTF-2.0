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

export type ClassicCtfBotRole = "attacker" | "defender" | "support";

export type ClassicCtfBotGoalKind =
  | "return-flag"
  | "recover-own-flag"
  | "escort-carrier"
  | "attack-flag"
  | "defend-base"
  | "patrol-base"
  | "support-mid";

export interface ClassicCtfBotGoal {
  readonly kind: ClassicCtfBotGoalKind;
  readonly position: WorldPosition;
  readonly targetKey: string;
}

export class ClassicCtfBotDecisionController {
  private patrolIndex = 0;

  constructor(
    private readonly role: ClassicCtfBotRole,
    private readonly map: WorldMapData,
  ) {}

  chooseGoal(
    actor: Readonly<ActorState>,
    snapshot: WorldSnapshot,
  ): ClassicCtfBotGoal {
    const ownFlag = teamFlag(snapshot, actor.teamId);
    const enemyFlag = snapshot.objectives.find((objective) =>
      isTeamFlag(objective) &&
      objective.state.controllingTeamId !== actor.teamId
    );
    const carriedFlag = flagCarriedBy(snapshot, actor.id);
    if (carriedFlag) {
      return goal(
        "return-flag",
        centerOf(baseFor(this.map, actor.teamId)),
        `return:${carriedFlag.id}`,
      );
    }

    const ownFlagCarrier = activeActor(
      snapshot,
      ownFlag?.state.interactingActorId,
    );
    if (ownFlagCarrier) {
      return goal(
        "recover-own-flag",
        ownFlagCarrier.position,
        `recover:${ownFlagCarrier.id}:${ownFlagCarrier.lifeId}`,
      );
    }

    const alliedCarrier = activeActor(
      snapshot,
      enemyFlag?.state.interactingActorId,
    );
    if (
      alliedCarrier?.teamId === actor.teamId &&
      this.role !== "defender"
    ) {
      return goal(
        "escort-carrier",
        escortPoint(
          alliedCarrier.position,
          centerOf(baseFor(this.map, actor.teamId)),
        ),
        `escort:${alliedCarrier.id}:${alliedCarrier.lifeId}`,
      );
    }

    if (this.role === "attacker") {
      return goal(
        "attack-flag",
        enemyFlag?.position ??
          centerOf(baseFor(this.map, opposingTeam(actor.teamId))),
        `attack:${enemyFlag?.id ?? opposingTeam(actor.teamId)}`,
      );
    }

    if (this.role === "defender") {
      const ownBase = centerOf(baseFor(this.map, actor.teamId));
      const invader = nearestEnemy(snapshot, actor, ownBase, 420);
      if (invader) {
        return goal(
          "defend-base",
          invader.position,
          `defend:${invader.id}:${invader.lifeId}`,
        );
      }
      const route = routeForTeam(
        this.map.presentation.botRoutes.defender,
        actor.teamId,
        this.map.geometry.bounds.maxX - this.map.geometry.bounds.minX,
      );
      const patrol = nextRoutePoint(
        route,
        actor.position,
        this.patrolIndex,
      );
      this.patrolIndex = patrol.nextIndex;
      return goal(
        "patrol-base",
        patrol.position ?? ownBase,
        `patrol:${this.patrolIndex}`,
      );
    }

    return goal(
      "support-mid",
      supportPoint(this.map, actor.teamId),
      `support:${actor.teamId}`,
    );
  }

  reset(): void {
    this.patrolIndex = 0;
  }
}

function goal(
  kind: ClassicCtfBotGoalKind,
  position: WorldPosition,
  targetKey: string,
): ClassicCtfBotGoal {
  return {
    kind,
    position: { ...position },
    targetKey,
  };
}

function teamFlag(
  snapshot: WorldSnapshot,
  teamId: TeamId | null,
): Readonly<Objective> | undefined {
  return snapshot.objectives.find((objective) =>
    isTeamFlag(objective) &&
    objective.state.controllingTeamId === teamId
  );
}

function flagCarriedBy(
  snapshot: WorldSnapshot,
  actorId: string,
): Readonly<Objective> | undefined {
  return snapshot.objectives.find((objective) =>
    isTeamFlag(objective) &&
    objective.state.status === "carried" &&
    objective.state.interactingActorId === actorId
  );
}

function isTeamFlag(objective: Readonly<Objective>): boolean {
  return objective.kind === "team-flag";
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

function nearestEnemy(
  snapshot: WorldSnapshot,
  actor: Readonly<ActorState>,
  point: WorldPosition,
  maxDistance: number,
): Readonly<ActorState> | null {
  let best: Readonly<ActorState> | null = null;
  let bestDistance = maxDistance;
  for (const candidate of snapshot.actors) {
    if (
      candidate.lifeState !== "active" ||
      !candidate.teamId ||
      candidate.teamId === actor.teamId
    ) {
      continue;
    }
    const distance = distanceBetween(candidate.position, point);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function routeForTeam(
  route: readonly WorldPosition[],
  teamId: TeamId | null,
  worldWidth: number,
): readonly WorldPosition[] {
  return teamId === "red"
    ? route.map((point) => ({ x: worldWidth - point.x, y: point.y }))
    : route;
}

function nextRoutePoint(
  route: readonly WorldPosition[],
  actorPosition: WorldPosition,
  routeIndex: number,
): { readonly position: WorldPosition | null; readonly nextIndex: number } {
  if (route.length === 0) {
    return { position: null, nextIndex: 0 };
  }
  let nextIndex = Math.min(routeIndex, route.length - 1);
  const current = route[nextIndex]!;
  if (distanceBetween(actorPosition, current) < 30) {
    nextIndex = (nextIndex + 1) % route.length;
  }
  return {
    position: route[nextIndex] ?? current,
    nextIndex,
  };
}

function supportPoint(
  map: WorldMapData,
  teamId: TeamId | null,
): WorldPosition {
  const home = centerOf(baseFor(map, teamId));
  const enemy = centerOf(baseFor(map, opposingTeam(teamId)));
  return {
    x: home.x + (enemy.x - home.x) * .42,
    y: home.y + (enemy.y - home.y) * .42,
  };
}

function escortPoint(
  carrier: WorldPosition,
  home: WorldPosition,
): WorldPosition {
  return {
    x: carrier.x + (home.x - carrier.x) * .28,
    y: carrier.y + (home.y - carrier.y) * .28,
  };
}

function baseFor(
  map: WorldMapData,
  teamId: TeamId | null,
): WorldMapPresentationRect {
  return teamId === "red"
    ? map.gameplay.redBase
    : map.gameplay.blueBase;
}

function opposingTeam(teamId: TeamId | null): TeamId {
  return teamId === "red" ? "blue" : "red";
}

function centerOf(rect: WorldMapPresentationRect): WorldPosition {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function distanceBetween(a: WorldPosition, b: WorldPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
