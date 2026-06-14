import type { WorldPosition } from "../actors";

export interface WorldJumpLink {
  readonly id: string;
  readonly from: WorldPosition;
  readonly to: WorldPosition;
  readonly activationRadius: number;
}

export interface WorldNavigation {
  readonly jumpLinks: readonly WorldJumpLink[];
}

export function createEmptyWorldNavigation(): WorldNavigation {
  return {
    jumpLinks: [],
  };
}
