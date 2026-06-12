import type {
  ActorState,
  WorldPosition,
} from "../actors";
import type { CoreActionIntent } from "../input";
import type {
  WorldRect,
  WorldSnapshot,
} from "../world";
import {
  V2_TDM_BOT_NAVIGATION_CONFIG,
  type BotNavigationConfig,
} from "./BotNavigationConfig";

interface GridCell {
  readonly x: number;
  readonly y: number;
}

export class TdmBotController {
  private path: WorldPosition[] = [];
  private pathIndex = 0;
  private repathRemainingMs = 0;
  private targetLifeId = -1;

  constructor(
    private readonly actorId: string,
    private readonly targetActorId: string,
    private readonly config: BotNavigationConfig =
      V2_TDM_BOT_NAVIGATION_CONFIG,
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

    this.repathRemainingMs -= Math.max(0, deltaMs);
    if (
      this.repathRemainingMs <= 0 ||
      this.pathIndex >= this.path.length ||
      target.lifeId !== this.targetLifeId
    ) {
      this.path = findPath(
        actor.position,
        target.position,
        snapshot,
        this.config,
      );
      this.pathIndex = 0;
      this.repathRemainingMs = this.config.repathIntervalMs;
      this.targetLifeId = target.lifeId;
    }

    while (
      this.pathIndex < this.path.length - 1 &&
      distance(actor.position, this.path[this.pathIndex]!) <=
        this.config.waypointReachDistance
    ) {
      this.pathIndex++;
    }
    const waypoint = this.path[this.pathIndex] ?? target.position;
    const direction = normalizedDirection(actor.position, waypoint);
    return [{
      action: "move",
      phase: "held",
      actorId: actor.id,
      direction,
      magnitude: this.config.inputMagnitude,
    }, {
      action: "aim",
      phase: "held",
      actorId: actor.id,
      direction: normalizedDirection(actor.position, target.position),
    }];
  }

  reset(): void {
    this.path = [];
    this.pathIndex = 0;
    this.repathRemainingMs = 0;
    this.targetLifeId = -1;
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

function findPath(
  from: WorldPosition,
  to: WorldPosition,
  snapshot: WorldSnapshot,
  config: BotNavigationConfig,
): WorldPosition[] {
  const bounds = snapshot.geometry.bounds;
  const cols = Math.max(
    1,
    Math.ceil((bounds.maxX - bounds.minX) / config.cellSize),
  );
  const rows = Math.max(
    1,
    Math.ceil((bounds.maxY - bounds.minY) / config.cellSize),
  );
  const start = cellFor(from, bounds.minX, bounds.minY, config.cellSize);
  const goal = cellFor(to, bounds.minX, bounds.minY, config.cellSize);
  const blockers = [
    ...snapshot.geometry.solids,
    ...snapshot.geometry.gaps,
  ];
  const startKey = key(start);
  const goalKey = key(goal);
  const open: GridCell[] = [start];
  const cameFrom = new Map<string, GridCell>();
  const costs = new Map<string, number>([[startKey, 0]]);
  const scores = new Map<string, number>([[
    startKey,
    heuristic(start, goal),
  ]]);

  while (open.length > 0) {
    open.sort((a, b) =>
      (scores.get(key(a)) ?? Infinity) - (scores.get(key(b)) ?? Infinity)
    );
    const current = open.shift()!;
    if (key(current) === goalKey) {
      return reconstructPath(
        current,
        cameFrom,
        bounds.minX,
        bounds.minY,
        config.cellSize,
      );
    }
    for (const neighbor of neighbors(current, cols, rows)) {
      if (
        key(neighbor) !== goalKey &&
        blocked(
          centerFor(neighbor, bounds.minX, bounds.minY, config.cellSize),
          blockers,
          config.obstaclePadding,
        )
      ) {
        continue;
      }
      const tentative = (costs.get(key(current)) ?? Infinity) +
        stepCost(current, neighbor);
      if (tentative >= (costs.get(key(neighbor)) ?? Infinity)) {
        continue;
      }
      cameFrom.set(key(neighbor), current);
      costs.set(key(neighbor), tentative);
      scores.set(key(neighbor), tentative + heuristic(neighbor, goal));
      if (!open.some((candidate) => key(candidate) === key(neighbor))) {
        open.push(neighbor);
      }
    }
  }
  return [to];
}

function reconstructPath(
  current: GridCell,
  cameFrom: Map<string, GridCell>,
  minX: number,
  minY: number,
  cellSize: number,
): WorldPosition[] {
  const cells = [current];
  while (cameFrom.has(key(current))) {
    current = cameFrom.get(key(current))!;
    cells.push(current);
  }
  cells.reverse();
  return cells.slice(1).map((cell) => centerFor(cell, minX, minY, cellSize));
}

function neighbors(
  cell: GridCell,
  cols: number,
  rows: number,
): GridCell[] {
  const result: GridCell[] = [];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      if (x === 0 && y === 0) {
        continue;
      }
      const next = { x: cell.x + x, y: cell.y + y };
      if (next.x >= 0 && next.y >= 0 && next.x < cols && next.y < rows) {
        result.push(next);
      }
    }
  }
  return result;
}

function blocked(
  point: WorldPosition,
  blockers: readonly WorldRect[],
  padding: number,
): boolean {
  return blockers.some((rect) =>
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

function cellFor(
  point: WorldPosition,
  minX: number,
  minY: number,
  cellSize: number,
): GridCell {
  return {
    x: Math.max(0, Math.floor((point.x - minX) / cellSize)),
    y: Math.max(0, Math.floor((point.y - minY) / cellSize)),
  };
}

function centerFor(
  cell: GridCell,
  minX: number,
  minY: number,
  cellSize: number,
): WorldPosition {
  return {
    x: minX + cell.x * cellSize + cellSize / 2,
    y: minY + cell.y * cellSize + cellSize / 2,
  };
}

function normalizedDirection(
  from: WorldPosition,
  to: WorldPosition,
): WorldPosition {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > .0001 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
}

function distance(a: WorldPosition, b: WorldPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function heuristic(a: GridCell, b: GridCell): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stepCost(a: GridCell, b: GridCell): number {
  return a.x !== b.x && a.y !== b.y ? Math.SQRT2 : 1;
}

function key(cell: GridCell): string {
  return `${cell.x},${cell.y}`;
}
