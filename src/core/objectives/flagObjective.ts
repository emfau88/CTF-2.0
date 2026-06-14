import type { TeamId, WorldPosition } from "../actors";
import type { Objective } from "./objective";

export type FlagObjectiveKind = "team-flag" | "neutral-flag";

export interface CreateFlagObjectiveInput {
  readonly id: string;
  readonly kind: FlagObjectiveKind;
  readonly position: WorldPosition;
  readonly teamId?: TeamId | null;
}

export function createFlagObjective(
  input: CreateFlagObjectiveInput,
): Objective {
  return {
    id: input.id,
    kind: input.kind,
    position: { ...input.position },
    state: {
      status: "home",
      controllingTeamId: input.teamId ?? null,
      interactingActorId: null,
    },
  };
}

export function isFlagObjective(
  objective: Readonly<Objective>,
): boolean {
  return objective.kind === "team-flag" ||
    objective.kind === "neutral-flag";
}
