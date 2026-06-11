import { createActorState } from "../actors";
import {
  createPickupState,
  V2_DIAGNOSTIC_PICKUP_CONFIG,
} from "../pickups";
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
  world.actors.push(createActorState({
    id: "diagnostic-target-1",
    kind: "diagnostic-target",
    teamId: "diagnostic-opponent",
    lifeState: "active",
    position: { x: 260, y: 410 },
    velocity: { x: 0, y: 0 },
    facing: { x: -1, y: 0 },
    radius: 24,
    health: 100,
    maxHealth: 100,
    armor: 20,
    maxArmor: 20,
  }));
  world.pickups.push(
    createPickupState(
      {
        id: "diagnostic-health-1",
        type: "health",
        position: { x: 150, y: 480 },
      },
      V2_DIAGNOSTIC_PICKUP_CONFIG,
    ),
    createPickupState(
      {
        id: "diagnostic-armor-1",
        type: "armor",
        position: { x: 240, y: 480 },
      },
      V2_DIAGNOSTIC_PICKUP_CONFIG,
    ),
  );
  return world;
}
