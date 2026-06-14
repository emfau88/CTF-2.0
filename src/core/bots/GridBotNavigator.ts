import type { WorldPosition } from "../actors";
import type {
  WorldJumpLink,
  WorldRect,
  WorldSnapshot,
} from "../world";
import {
  V2_BOT_NAVIGATION_CONFIG,
  type BotNavigationConfig,
} from "./BotNavigationConfig";

interface GridCell {
  readonly x: number;
  readonly y: number;
}

interface PathEdge {
  readonly from: GridCell;
  readonly jumpLink?: WorldJumpLink;
}

interface PathWaypoint {
  readonly position: WorldPosition;
  readonly jumpLink?: WorldJumpLink;
}

export interface BotNavigationDecision {
  readonly direction: WorldPosition;
  readonly jump: boolean;
}

export interface BotNavigator {
  navigate(
    from: WorldPosition,
    target: WorldPosition,
    targetKey: string,
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): BotNavigationDecision;
  reset(): void;
}

export class GridBotNavigator implements BotNavigator {
  private path: PathWaypoint[] = [];
  private pathIndex = 0;
  private repathRemainingMs = 0;
  private targetKey = "";

  constructor(
    private readonly config: BotNavigationConfig =
      V2_BOT_NAVIGATION_CONFIG,
  ) {}

  navigate(
    from: WorldPosition,
    target: WorldPosition,
    targetKey: string,
    snapshot: WorldSnapshot,
    deltaMs: number,
  ): BotNavigationDecision {
    this.repathRemainingMs -= Math.max(0, deltaMs);
    const currentWaypoint = this.path[this.pathIndex];
    const traversingJump = Boolean(
      currentWaypoint?.jumpLink &&
        distance(from, currentWaypoint.position) >
          this.config.waypointReachDistance,
    );
    if (
      !traversingJump &&
      (
        this.repathRemainingMs <= 0 ||
        this.pathIndex >= this.path.length ||
        targetKey !== this.targetKey
      )
    ) {
      this.path = findPath(from, target, snapshot, this.config);
      this.pathIndex = 0;
      this.repathRemainingMs = this.config.repathIntervalMs;
      this.targetKey = targetKey;
    }

    while (
      this.pathIndex < this.path.length - 1 &&
      distance(from, this.path[this.pathIndex]!.position) <=
        this.config.waypointReachDistance
    ) {
      this.pathIndex++;
    }
    const waypoint = this.path[this.pathIndex];
    const jumpLink = waypoint?.jumpLink;
    return {
      direction: normalizedDirection(from, waypoint?.position ?? target),
      jump: Boolean(
        jumpLink &&
          distance(from, jumpLink.from) <= jumpLink.activationRadius,
      ),
    };
  }

  reset(): void {
    this.path = [];
    this.pathIndex = 0;
    this.repathRemainingMs = 0;
    this.targetKey = "";
  }
}

function findPath(
  from: WorldPosition,
  to: WorldPosition,
  snapshot: WorldSnapshot,
  config: BotNavigationConfig,
): PathWaypoint[] {
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
  const cameFrom = new Map<string, PathEdge>();
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
    for (const candidate of navigationEdges(
      current,
      cols,
      rows,
      snapshot.navigation.jumpLinks,
      bounds.minX,
      bounds.minY,
      config,
    )) {
      const neighbor = candidate.cell;
      if (
        !candidate.jumpLink &&
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
        (candidate.jumpLink
          ? distance(candidate.jumpLink.from, candidate.jumpLink.to) /
            config.cellSize
          : stepCost(current, neighbor));
      if (tentative >= (costs.get(key(neighbor)) ?? Infinity)) continue;
      cameFrom.set(key(neighbor), {
        from: current,
        jumpLink: candidate.jumpLink,
      });
      costs.set(key(neighbor), tentative);
      scores.set(key(neighbor), tentative + heuristic(neighbor, goal));
      if (!open.some((openCell) => key(openCell) === key(neighbor))) {
        open.push(neighbor);
      }
    }
  }
  return [{ position: from }];
}

function navigationEdges(
  cell: GridCell,
  cols: number,
  rows: number,
  jumpLinks: readonly WorldJumpLink[],
  minX: number,
  minY: number,
  config: BotNavigationConfig,
): { readonly cell: GridCell; readonly jumpLink?: WorldJumpLink }[] {
  const result: {
    readonly cell: GridCell;
    readonly jumpLink?: WorldJumpLink;
  }[] = neighbors(cell, cols, rows).map((neighbor) => ({
    cell: neighbor,
  }));
  const center = centerFor(cell, minX, minY, config.cellSize);
  for (const jumpLink of jumpLinks) {
    if (
      distance(center, jumpLink.from) >
        config.cellSize * .75 + jumpLink.activationRadius
    ) {
      continue;
    }
    result.push({
      cell: cellFor(jumpLink.to, minX, minY, config.cellSize),
      jumpLink,
    });
  }
  return result;
}

function reconstructPath(
  goal: GridCell,
  cameFrom: Map<string, PathEdge>,
  minX: number,
  minY: number,
  cellSize: number,
): PathWaypoint[] {
  const reversed: PathWaypoint[] = [];
  let current = goal;
  while (cameFrom.has(key(current))) {
    const edge = cameFrom.get(key(current))!;
    reversed.push({
      position: edge.jumpLink
        ? { ...edge.jumpLink.to }
        : centerFor(current, minX, minY, cellSize),
      jumpLink: edge.jumpLink,
    });
    current = edge.from;
  }
  return reversed.reverse();
}

function neighbors(
  cell: GridCell,
  cols: number,
  rows: number,
): GridCell[] {
  const result: GridCell[] = [];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      if (x === 0 && y === 0) continue;
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
