import type {
  ActorId,
  TeamId,
  WorldPosition,
  WorldVelocity,
} from "../actors";

export type ProjectileId = string;
export type ProjectileLifeState = "active" | "hit" | "expired";
export type ProjectileWeaponId =
  | "diagnostic-blaster"
  | "basic-autoshoot"
  | "rocket";

export interface ProjectileState {
  readonly id: ProjectileId;
  readonly ownerActorId: ActorId;
  readonly teamId: TeamId | null;
  readonly weaponId: ProjectileWeaponId;
  position: WorldPosition;
  velocity: WorldVelocity;
  readonly damage: number;
  readonly radius: number;
  readonly splashRadius?: number;
  readonly knockback?: number;
  remainingLifetimeMs: number;
  remainingRange: number;
  lifeState: ProjectileLifeState;
}
