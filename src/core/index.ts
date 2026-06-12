export {
  applyDamage,
  createActorState,
  updateActorLifecycle,
  V2_ACTOR_LIFECYCLE_CONFIG,
  type ActorDamageResult,
  type ActorJumpPhase,
  type ActorJumpState,
  type ActorLifecycleConfig,
  type ActorLifecycleResult,
  type ActorLifeState,
  type ActorRespawnState,
  type ActorId,
  type ActorState,
  type CreateActorStateInput,
  type TeamId,
  type WorldFacing,
  type WorldPosition,
  type WorldVelocity,
} from "./actors";
export type { GameEvent } from "./events";
export {
  fireDiagnosticProjectile,
  updateBasicAutoAttacks,
  updateProjectiles,
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_DIAGNOSTIC_BLASTER_CONFIG,
  type BasicAutoAttackConfig,
  type DiagnosticFireResult,
  type DiagnosticWeaponConfig,
  type ProjectileId,
  type ProjectileLifeState,
  type ProjectileState,
  type ProjectileUpdateResult,
} from "./combat";
export type {
  CoreActionIntent,
  CoreActionPhase,
  CoreInputFrame,
} from "./input";
export type {
  GameMode,
  GameModeId,
  ModeHudState,
} from "./modes";
export {
  createMatchState,
  DiagnosticArenaMode,
  V2_DIAGNOSTIC_ARENA_MODE_CONFIG,
  type DiagnosticArenaModeConfig,
  type MatchPhase,
  type MatchResult,
  type MatchState,
  TeamDeathmatchMode,
  V2_TEAM_DEATHMATCH_CONFIG,
  type TeamDeathmatchModeConfig,
} from "./modes";
export {
  applyGroundMovement,
  applyJumpMovement,
  applyWorldCollision,
  V2_COLLISION_GROUNDWORK_CONFIG,
  V2_GROUND_PARITY_CONFIG,
  V2_JUMP_PARITY_CONFIG,
  type GroundMovementConfig,
  type GroundMovementInput,
  type GroundMovementResult,
  type GroundMovementState,
  type JumpConfig,
  type JumpInput,
  type JumpMovementResult,
  type JumpMovementState,
  type CollisionConfig,
  type WorldCollisionResult,
} from "./movement";
export type { Objective, ObjectiveState } from "./objectives";
export {
  createPickupState,
  updatePickups,
  V2_DIAGNOSTIC_PICKUP_CONFIG,
  type CreatePickupStateInput,
  type PickupConfig,
  type PickupId,
  type PickupLifeState,
  type PickupState,
  type PickupType,
  type PickupUpdateResult,
} from "./pickups";
export {
  createTeamDeathmatchWorldState,
  GameplayCoreRuntime,
  type CoreFrameResult,
  type CoreRuntime,
  type GameplayCoreRuntimeOptions,
} from "./runtime";
export {
  awardScore,
  createScoreBoardState,
  scoreFor,
  type ScoreBoard,
  type ScoreBoardState,
  type ScoreEntry,
  type ScoreAwardRejectionReason,
  type ScoreAwardResult,
} from "./scoring";
export type {
  SpawnPoint,
  SpawnProvider,
  SpawnRequest,
} from "./spawning";
export { AssignedSpawnProvider } from "./spawning";
export {
  createEmptyWorldState,
  createWorldSnapshot,
  createEmptyWorldGeometry,
  TRAINING_CROSSING_V2,
  type WorldBounds,
  type WorldGeometry,
  type WorldMapData,
  type WorldMapInfo,
  type WorldRect,
  type WorldSnapshot,
  type WorldState,
} from "./world";
