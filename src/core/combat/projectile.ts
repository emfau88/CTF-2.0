import type {
  ActorId,
  TeamId,
  WorldPosition,
  WorldVelocity,
} from "../actors";

export type ProjectileId = string;
export type ProjectileLifeState = "active" | "hit" | "expired";

export interface ProjectileState {
  readonly id: ProjectileId;
  readonly ownerActorId: ActorId;
  readonly teamId: TeamId | null;
  position: WorldPosition;
  velocity: WorldVelocity;
  readonly damage: number;
  readonly radius: number;
  remainingLifetimeMs: number;
  remainingRange: number;
  lifeState: ProjectileLifeState;
}
