import type { WorldMapData } from "./worldMapData";
import { createTeamSpawnPoints } from "./createTeamSpawnPoints";

const walls = [
  // Split base shields create upper, middle, and lower departures.
  { x: 280, y: 120, width: 55, height: 210, visual: "industrial-barrier" },
  { x: 280, y: 490, width: 55, height: 210, visual: "industrial-barrier" },
  { x: 1665, y: 120, width: 55, height: 210, visual: "industrial-barrier" },
  { x: 1665, y: 490, width: 55, height: 210, visual: "industrial-barrier" },
  { x: 430, y: 370, width: 120, height: 80, visual: "industrial-barrier" },
  { x: 1450, y: 370, width: 120, height: 80, visual: "industrial-barrier" },

  // Four broken corners define an objective courtyard with four entrances.
  { x: 760, y: 250, width: 150, height: 45, visual: "industrial-barrier" },
  { x: 1090, y: 250, width: 150, height: 45, visual: "industrial-barrier" },
  { x: 760, y: 525, width: 150, height: 45, visual: "industrial-barrier" },
  { x: 1090, y: 525, width: 150, height: 45, visual: "industrial-barrier" },
  { x: 760, y: 295, width: 45, height: 80, visual: "industrial-barrier" },
  { x: 760, y: 445, width: 45, height: 80, visual: "industrial-barrier" },
  { x: 1195, y: 295, width: 45, height: 80, visual: "industrial-barrier" },
  { x: 1195, y: 445, width: 45, height: 80, visual: "industrial-barrier" },

  // Short separators preserve the outer circuit without making corridors rigid.
  { x: 580, y: 145, width: 55, height: 140, visual: "industrial-barrier" },
  { x: 1365, y: 145, width: 55, height: 140, visual: "industrial-barrier" },
  { x: 580, y: 535, width: 55, height: 140, visual: "industrial-barrier" },
  { x: 1365, y: 535, width: 55, height: 140, visual: "industrial-barrier" },

  // Small cover islands break long rail sightlines on the fast outer route.
  { x: 875, y: 65, width: 70, height: 105, visual: "industrial-barrier" },
  { x: 1055, y: 65, width: 70, height: 105, visual: "industrial-barrier" },
  { x: 875, y: 650, width: 70, height: 105, visual: "industrial-barrier" },
  { x: 1055, y: 650, width: 70, height: 105, visual: "industrial-barrier" },
] as const;

const gaps = [
  { x: 960, y: 100, width: 80, height: 70, visual: "maintenance-pit" },
  { x: 960, y: 650, width: 80, height: 70, visual: "maintenance-pit" },
] as const;

export const FLOW_CIRCUIT_V2: WorldMapData = {
  id: "flow-circuit-v2",
  displayName: "Flow Circuit",
  geometry: {
    bounds: { minX: 0, minY: 0, maxX: 2000, maxY: 820 },
    solids: walls.map((wall, index) => ({
      id: `wall-${String(index + 1).padStart(2, "0")}`,
      x: wall.x,
      y: wall.y,
      width: wall.width,
      height: wall.height,
    })),
    gaps: gaps.map((gap, index) => ({
      id: `gap-${String(index + 1).padStart(2, "0")}`,
      x: gap.x,
      y: gap.y,
      width: gap.width,
      height: gap.height,
    })),
  },
  navigation: {
    jumpLinks: [
      {
        id: "upper-gap-west-east",
        from: { x: 925, y: 135 },
        to: { x: 1075, y: 135 },
        activationRadius: 44,
      },
      {
        id: "upper-gap-east-west",
        from: { x: 1075, y: 135 },
        to: { x: 925, y: 135 },
        activationRadius: 44,
      },
      {
        id: "lower-gap-west-east",
        from: { x: 925, y: 685 },
        to: { x: 1075, y: 685 },
        activationRadius: 44,
      },
      {
        id: "lower-gap-east-west",
        from: { x: 1075, y: 685 },
        to: { x: 925, y: 685 },
        activationRadius: 44,
      },
    ],
  },
  spawnPoints: [
    ...createTeamSpawnPoints({
      teamId: "blue",
      position: { x: 135, y: 410 },
      facing: { x: 1, y: 0 },
      tags: ["player", "tdm", "flow-test"],
    }),
    ...createTeamSpawnPoints({
      teamId: "red",
      position: { x: 1865, y: 410 },
      facing: { x: -1, y: 0 },
      tags: ["player", "tdm", "flow-test"],
    }),
  ],
  pickupSpawns: [
    { id: "armor-center", type: "armor", position: { x: 1000, y: 410 } },
    { id: "health-court-west", type: "health", position: { x: 850, y: 410 } },
    { id: "health-court-east", type: "health", position: { x: 1150, y: 410 } },
    { id: "health-upper-west", type: "health", position: { x: 700, y: 85 } },
    { id: "health-upper-east", type: "health", position: { x: 1300, y: 85 } },
    { id: "health-lower-west", type: "health", position: { x: 700, y: 735 } },
    { id: "health-lower-east", type: "health", position: { x: 1300, y: 735 } },
    { id: "rocket-west", type: "rocket", position: { x: 500, y: 220 } },
    { id: "rocket-east", type: "rocket", position: { x: 1500, y: 220 } },
    { id: "rail-upper", type: "rail", position: { x: 1000, y: 45 } },
    { id: "rail-lower", type: "rail", position: { x: 1000, y: 775 } },
    { id: "whip-west", type: "whip", position: { x: 680, y: 410 } },
    { id: "whip-east", type: "whip", position: { x: 1320, y: 410 } },
    { id: "armor-blue", type: "armor", position: { x: 390, y: 610 } },
    { id: "armor-red", type: "armor", position: { x: 1610, y: 610 } },
  ],
  gameplay: {
    blueBase: { x: 45, y: 285, width: 205, height: 250 },
    redBase: { x: 1750, y: 285, width: 205, height: 250 },
    combatZone: { x: 825, y: 320, width: 350, height: 180 },
  },
  presentation: {
    theme: "industrial",
    plan: "Compact symmetric flow test with an outer circuit, a four-entry objective courtyard, bounded sightlines, and short recovery routes.",
    walls,
    gaps,
    decorations: [
      { kind: "industrial-edge-pipes", x: 350, y: -12, width: 520, height: 94 },
      { kind: "industrial-edge-pipes", x: 1130, y: 738, width: 520, height: 94 },
      { kind: "industrial-edge-tank", x: 38, y: -34, width: 128, height: 160 },
      { kind: "industrial-edge-tank", x: 1834, y: 694, width: 128, height: 160 },
      { kind: "industrial-edge-turbine", x: 918, y: -42, width: 164, height: 164 },
      { kind: "industrial-edge-turbine", x: 918, y: 698, width: 164, height: 164 },
    ],
    botRoutes: {
      attacker: [
        { x: 1835, y: 410 }, { x: 1600, y: 180 },
        { x: 1300, y: 115 }, { x: 1000, y: 200 },
        { x: 700, y: 115 }, { x: 400, y: 180 },
        { x: 165, y: 410 },
      ],
      defender: [
        { x: 1770, y: 250 }, { x: 1900, y: 315 },
        { x: 1900, y: 505 }, { x: 1770, y: 570 },
      ],
    },
  },
  diagnosticSpawn: { x: 1865, y: 410 },
};
