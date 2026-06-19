import type { ActorId, TeamId, WorldPosition } from "../actors";

export interface ObjectiveState {
  readonly status: string;
  readonly controllingTeamId?: TeamId | null;
  readonly interactingActorId?: ActorId | null;
  readonly progress?: number;
  readonly returnRemainingMs?: number;
}

export interface Objective {
  readonly id: string;
  readonly kind: string;
  readonly position: WorldPosition;
  readonly state: ObjectiveState;
}
