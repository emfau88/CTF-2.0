import { createActorState } from "../actors";
import { createEmptyWorldState, type WorldState } from "../world";

const MODE_ID = "inert";

export function createDiagnosticWorldState(): WorldState {
  const world = createEmptyWorldState(MODE_ID);
  world.geometry = {
    bounds: {
      minX: 40,
      minY: 40,
      maxX: 660,
      maxY: 560,
    },
    solids: [
      { id: "solid-column", x: 300, y: 70, width: 44, height: 190 },
      { id: "solid-barrier", x: 430, y: 380, width: 170, height: 34 },
    ],
    gaps: [
      { id: "gap-short-long-test", x: 250, y: 305, width: 150, height: 72 },
      { id: "gap-corner", x: 500, y: 105, width: 90, height: 90 },
    ],
  };
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
