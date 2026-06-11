import type { ActorState } from "../actors";
import type { GameModeId } from "../modes";
import type { Objective } from "../objectives";
import type { ScoreEntry } from "../scoring";

export interface WorldState {
  timeMs: number;
  modeId: GameModeId;
  actors: ActorState[];
  objectives: Objective[];
  scores: ScoreEntry[];
}

export interface WorldSnapshot {
  readonly timeMs: number;
  readonly modeId: GameModeId;
  readonly actors: readonly Readonly<ActorState>[];
  readonly objectives: readonly Readonly<Objective>[];
  readonly scores: readonly ScoreEntry[];
}

export function createEmptyWorldState(
  modeId: GameModeId = "inert",
): WorldState {
  return {
    timeMs: 0,
    modeId,
    actors: [],
    objectives: [],
    scores: [],
  };
}

export function createWorldSnapshot(world: WorldState): WorldSnapshot {
  return {
    timeMs: world.timeMs,
    modeId: world.modeId,
    actors: world.actors.map((actor) => ({
      ...actor,
      position: { ...actor.position },
      velocity: { ...actor.velocity },
      facing: { ...actor.facing },
      respawn: actor.respawn ? { ...actor.respawn } : null,
    })),
    objectives: world.objectives.map((objective) => ({
      ...objective,
      position: { ...objective.position },
      state: { ...objective.state },
    })),
    scores: world.scores.map((score) => ({ ...score })),
  };
}
