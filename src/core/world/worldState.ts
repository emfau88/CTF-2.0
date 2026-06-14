import type { ActorState } from "../actors";
import type { ProjectileState } from "../combat";
import type { GameModeId, MatchState } from "../modes";
import type { Objective } from "../objectives";
import type { PickupState } from "../pickups";
import type { SpawnPoint } from "../spawning";
import {
  createScoreBoardState,
  type ScoreBoardState,
} from "../scoring";
import {
  createEmptyWorldGeometry,
  type WorldGeometry,
} from "./worldGeometry";
import type { WorldMapInfo } from "./maps";
import {
  createEmptyWorldNavigation,
  type WorldNavigation,
} from "./worldNavigation";

export interface WorldState {
  timeMs: number;
  modeId: GameModeId;
  actors: ActorState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  objectives: Objective[];
  scoreBoard: ScoreBoardState;
  match: MatchState | null;
  spawnPoints: SpawnPoint[];
  geometry: WorldGeometry;
  navigation: WorldNavigation;
  map: WorldMapInfo | null;
}

export interface WorldSnapshot {
  readonly timeMs: number;
  readonly modeId: GameModeId;
  readonly actors: readonly Readonly<ActorState>[];
  readonly projectiles: readonly Readonly<ProjectileState>[];
  readonly pickups: readonly Readonly<PickupState>[];
  readonly objectives: readonly Readonly<Objective>[];
  readonly scoreBoard: Readonly<ScoreBoardState>;
  readonly match: Readonly<MatchState> | null;
  readonly spawnPoints: readonly SpawnPoint[];
  readonly geometry: WorldGeometry;
  readonly navigation: WorldNavigation;
  readonly map: WorldMapInfo | null;
}

export function createEmptyWorldState(
  modeId: GameModeId = "inert",
): WorldState {
  return {
    timeMs: 0,
    modeId,
    actors: [],
    projectiles: [],
    pickups: [],
    objectives: [],
    scoreBoard: createScoreBoardState(),
    match: null,
    spawnPoints: [],
    geometry: createEmptyWorldGeometry(),
    navigation: createEmptyWorldNavigation(),
    map: null,
  };
}

export function createWorldSnapshot(world: WorldState): WorldSnapshot {
  return {
    timeMs: world.timeMs,
    modeId: world.modeId,
    actors: world.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      spawnPosition: { ...actor.spawnPosition },
      velocity: { ...actor.velocity },
      facing: { ...actor.facing },
      lastMoveDirection: { ...actor.lastMoveDirection },
      jump: { ...actor.jump },
      weapons: { ...actor.weapons },
      lastSafePosition: { ...actor.lastSafePosition },
      respawn: actor.respawn ? { ...actor.respawn } : null,
    })),
    projectiles: world.projectiles.map((projectile) => ({
      ...projectile,
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
    })),
    pickups: world.pickups.map((pickup) => ({
      ...pickup,
      position: { ...pickup.position },
    })),
    objectives: world.objectives.map((objective) => ({
      ...objective,
      position: { ...objective.position },
      state: { ...objective.state },
    })),
    scoreBoard: {
      entries: world.scoreBoard.entries.map((entry) => ({ ...entry })),
      processedAwardKeys: [...world.scoreBoard.processedAwardKeys],
    },
    match: world.match
      ? {
        ...world.match,
        result: world.match.result ? { ...world.match.result } : null,
      }
      : null,
    spawnPoints: world.spawnPoints.map((spawnPoint) => ({
      ...spawnPoint,
      position: { ...spawnPoint.position },
      facing: spawnPoint.facing ? { ...spawnPoint.facing } : undefined,
      tags: spawnPoint.tags ? [...spawnPoint.tags] : undefined,
    })),
    geometry: {
      bounds: { ...world.geometry.bounds },
      solids: world.geometry.solids.map((solid) => ({ ...solid })),
      gaps: world.geometry.gaps.map((gap) => ({ ...gap })),
    },
    navigation: {
      jumpLinks: world.navigation.jumpLinks.map((link) => ({
        ...link,
        from: { ...link.from },
        to: { ...link.to },
      })),
    },
    map: world.map ? { ...world.map } : null,
  };
}
