import { createActorState } from "../actors";
import {
  createEmptyWorldState,
  TRAINING_CROSSING_V2,
  type WorldState,
} from "../world";

const MODE_ID = "inert";

export function createDiagnosticWorldState(): WorldState {
  const world = createEmptyWorldState(MODE_ID);
  world.geometry = {
    bounds: { ...TRAINING_CROSSING_V2.geometry.bounds },
    solids: TRAINING_CROSSING_V2.geometry.solids.map((solid) => ({
      ...solid,
    })),
    gaps: TRAINING_CROSSING_V2.geometry.gaps.map((gap) => ({ ...gap })),
  };
  world.map = {
    id: TRAINING_CROSSING_V2.id,
    displayName: TRAINING_CROSSING_V2.displayName,
  };
  world.actors.push(createActorState({
    id: "diagnostic-actor-1",
    kind: "diagnostic",
    teamId: "diagnostic-team",
    lifeState: "active",
    position: { ...TRAINING_CROSSING_V2.diagnosticSpawn },
    velocity: { x: 0, y: 0 },
    facing: { x: 1, y: 0 },
    radius: 24,
    health: 75,
    maxHealth: 100,
    armor: 25,
    maxArmor: 50,
  }));
  return world;
}
