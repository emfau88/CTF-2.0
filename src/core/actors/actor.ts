export type ActorId = string;
export type TeamId = string;

export type ActorLifeState =
  | "active"
  | "falling"
  | "dead"
  | "respawning"
  | "inactive";

export type WorldPosition = {
  x: number;
  y: number;
};

export type WorldVelocity = {
  x: number;
  y: number;
};

export type WorldFacing = {
  x: number;
  y: number;
};

export interface ActorRespawnState {
  remainingMs: number;
  readonly reason: "death" | "fall";
  readonly spawnPointId?: string;
}

export type ActorJumpPhase =
  | "ready"
  | "held"
  | "airborne"
  | "cooldown";

export interface ActorJumpState {
  active: boolean;
  held: boolean;
  grounded: boolean;
  phase: ActorJumpPhase;
  elapsedMs: number;
  plannedDurationMs: number;
  cooldownRemainingMs: number;
  height: number;
}

export interface ActorState {
  readonly id: ActorId;
  readonly kind: string;
  teamId: TeamId | null;
  lifeState: ActorLifeState;
  position: WorldPosition;
  spawnPosition: WorldPosition;
  velocity: WorldVelocity;
  facing: WorldFacing;
  lastMoveDirection: WorldFacing;
  jump: ActorJumpState;
  lastSafePosition: WorldPosition;
  safePositionElapsedMs: number;
  overGap: boolean;
  radius: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  primaryFireCooldownMs: number;
  respawn: ActorRespawnState | null;
}

export type CreateActorStateInput = {
  readonly id: ActorId;
  readonly kind: string;
  readonly teamId?: TeamId | null;
  readonly lifeState?: ActorLifeState;
  readonly position?: WorldPosition;
  readonly spawnPosition?: WorldPosition;
  readonly velocity?: WorldVelocity;
  readonly facing?: WorldFacing;
  readonly lastMoveDirection?: WorldFacing;
  readonly jump?: ActorJumpState;
  readonly lastSafePosition?: WorldPosition;
  readonly safePositionElapsedMs?: number;
  readonly overGap?: boolean;
  readonly radius?: number;
  readonly health?: number;
  readonly maxHealth?: number;
  readonly armor?: number;
  readonly maxArmor?: number;
  readonly primaryFireCooldownMs?: number;
  readonly respawn?: ActorRespawnState | null;
};

export function createActorState(input: CreateActorStateInput): ActorState {
  const maxHealth = input.maxHealth ?? 100;
  const maxArmor = input.maxArmor ?? 0;

  return {
    id: input.id,
    kind: input.kind,
    teamId: input.teamId ?? null,
    lifeState: input.lifeState ?? "active",
    position: { ...(input.position ?? { x: 0, y: 0 }) },
    spawnPosition: {
      ...(input.spawnPosition ?? input.position ?? { x: 0, y: 0 }),
    },
    velocity: { ...(input.velocity ?? { x: 0, y: 0 }) },
    facing: { ...(input.facing ?? { x: 1, y: 0 }) },
    lastMoveDirection: {
      ...(input.lastMoveDirection ?? input.facing ?? { x: 1, y: 0 }),
    },
    jump: {
      ...(input.jump ?? {
        active: false,
        held: false,
        grounded: true,
        phase: "ready",
        elapsedMs: 0,
        plannedDurationMs: 180,
        cooldownRemainingMs: 0,
        height: 0,
      }),
    },
    lastSafePosition: {
      ...(input.lastSafePosition ?? input.position ?? { x: 0, y: 0 }),
    },
    safePositionElapsedMs: input.safePositionElapsedMs ?? 0,
    overGap: input.overGap ?? false,
    radius: input.radius ?? 0,
    health: input.health ?? maxHealth,
    maxHealth,
    armor: input.armor ?? maxArmor,
    maxArmor,
    primaryFireCooldownMs: input.primaryFireCooldownMs ?? 0,
    respawn: input.respawn ? { ...input.respawn } : null,
  };
}
