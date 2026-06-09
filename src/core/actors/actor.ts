export type ActorId = string;
export type TeamId = string;

export type ActorState = "active" | "dead" | "respawning" | "inactive";

export type WorldPosition = {
  x: number;
  y: number;
};

export type WorldVelocity = {
  x: number;
  y: number;
};

export interface Actor {
  readonly id: ActorId;
  readonly kind: string;
  teamId: TeamId | null;
  state: ActorState;
  position: WorldPosition;
  velocity: WorldVelocity;
  radius: number;
  health: number;
  maxHealth: number;
  armor: number;
}
