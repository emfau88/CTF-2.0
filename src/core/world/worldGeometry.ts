export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface WorldRect {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WorldGeometry {
  readonly bounds: WorldBounds;
  readonly solids: readonly WorldRect[];
  readonly gaps: readonly WorldRect[];
}

export function createEmptyWorldGeometry(): WorldGeometry {
  return {
    bounds: {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    },
    solids: [],
    gaps: [],
  };
}
