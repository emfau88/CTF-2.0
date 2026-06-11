import type { ActorState } from "../actors";
import type { ProjectileState } from "../combat";
import type { GameModeId } from "../modes";
import type { Objective } from "../objectives";
import type { ScoreEntry } from "../scoring";
import {
  createEmptyWorldGeometry,
  type WorldGeometry,
} from "./worldGeometry";
import type { WorldMapInfo } from "./maps";

export interface WorldState {
  timeMs: number;
  modeId: GameModeId;
  actors: ActorState[];
  projectiles: ProjectileState[];
  objectives: Objective[];
  scores: ScoreEntry[];
  geometry: WorldGeometry;
  map: WorldMapInfo | null;
}

export interface WorldSnapshot {
  readonly timeMs: number;
  readonly modeId: GameModeId;
  readonly actors: readonly Readonly<ActorState>[];
  readonly projectiles: readonly Readonly<ProjectileState>[];
  readonly objectives: readonly Readonly<Objective>[];
  readonly scores: readonly ScoreEntry[];
  readonly geometry: WorldGeometry;
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
    objectives: [],
    scores: [],
    geometry: createEmptyWorldGeometry(),
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
      lastSafePosition: { ...actor.lastSafePosition },
      respawn: actor.respawn ? { ...actor.respawn } : null,
    })),
    projectiles: world.projectiles.map((projectile) => ({
      ...projectile,
      position: { ...projectile.position },
      velocity: { ...projectile.velocity },
    })),
    objectives: world.objectives.map((objective) => ({
      ...objective,
      position: { ...objective.position },
      state: { ...objective.state },
    })),
    scores: world.scores.map((score) => ({ ...score })),
    geometry: {
      bounds: { ...world.geometry.bounds },
      solids: world.geometry.solids.map((solid) => ({ ...solid })),
      gaps: world.geometry.gaps.map((gap) => ({ ...gap })),
    },
    map: world.map ? { ...world.map } : null,
  };
}
