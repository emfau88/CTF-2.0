import { createActorState } from "../actors";
import { createEmptyWorldState, type WorldState } from "../world";

const MODE_ID = "inert";

export function createDiagnosticWorldState(): WorldState {
  const world = createEmptyWorldState(MODE_ID);
  world.actors.push(createActorState({
    id: "diagnostic-actor-1",
    kind: "diagnostic",
    teamId: "diagnostic-team",
    lifeState: "active",
    position: { x: 180, y: 180 },
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
