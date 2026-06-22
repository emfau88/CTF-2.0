import type { WorldMapData } from "./worldMapData";
import { createTeamSpawnPoints } from "./createTeamSpawnPoints";

const walls = [
  // Base shields: three readable exits per side without spawn-to-spawn sight.
  { x: 300, y: 250, width: 60, height: 150, visual: "stone-wall" },
  { x: 300, y: 500, width: 60, height: 150, visual: "stone-wall" },
  { x: 1840, y: 250, width: 60, height: 150, visual: "stone-wall" },
  { x: 1840, y: 500, width: 60, height: 150, visual: "stone-wall" },
  { x: 500, y: 405, width: 140, height: 90, visual: "stone-wall" },
  { x: 1560, y: 405, width: 140, height: 90, visual: "stone-wall" },

  // Lane walls create three routes while leaving broad cross-lane rotations.
  { x: 500, y: 275, width: 300, height: 50, visual: "stone-wall" },
  { x: 1400, y: 275, width: 300, height: 50, visual: "stone-wall" },
  { x: 500, y: 575, width: 300, height: 50, visual: "stone-wall" },
  { x: 1400, y: 575, width: 300, height: 50, visual: "stone-wall" },

  // Central cover breaks rail dominance but keeps the flag area escapable.
  { x: 900, y: 335, width: 100, height: 90, visual: "stone-wall" },
  { x: 1200, y: 475, width: 100, height: 90, visual: "stone-wall" },

  // Upper rail/rocket flank: long lane with cover islands and a jump shortcut.
  { x: 820, y: 90, width: 70, height: 130, visual: "stone-wall" },
  { x: 1310, y: 90, width: 70, height: 130, visual: "stone-wall" },
  { x: 1000, y: 180, width: 200, height: 55, visual: "stone-wall" },

  // Lower close-range flank: short sight pockets with several exits.
  { x: 820, y: 650, width: 60, height: 130, visual: "stone-wall" },
  { x: 1320, y: 650, width: 60, height: 130, visual: "stone-wall" },
  { x: 980, y: 620, width: 60, height: 90, visual: "stone-wall" },
  { x: 1160, y: 620, width: 60, height: 90, visual: "stone-wall" },
] as const;

const gaps = [
  { x: 1035, y: 690, width: 130, height: 70, visual: "chasm" },
] as const;

export const FLOW_LAB_V2: WorldMapData = {
  id: "flow-lab-v2",
  displayName: "Flow Lab",
  geometry: {
    bounds: { minX: 0, minY: 0, maxX: 2200, maxY: 900 },
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
        id: "upper-wall-north-south",
        from: { x: 1100, y: 145 },
        to: { x: 1100, y: 270 },
        activationRadius: 44,
      },
      {
        id: "upper-wall-south-north",
        from: { x: 1100, y: 270 },
        to: { x: 1100, y: 145 },
        activationRadius: 44,
      },
      {
        id: "lower-gap-north-south",
        from: { x: 1100, y: 650 },
        to: { x: 1100, y: 800 },
        activationRadius: 44,
      },
      {
        id: "lower-gap-south-north",
        from: { x: 1100, y: 800 },
        to: { x: 1100, y: 650 },
        activationRadius: 44,
      },
    ],
  },
  spawnPoints: [
    ...createTeamSpawnPoints({
      teamId: "blue",
      position: { x: 150, y: 450 },
      facing: { x: 1, y: 0 },
      tags: ["player", "tdm", "greybox"],
    }),
    ...createTeamSpawnPoints({
      teamId: "red",
      position: { x: 2050, y: 450 },
      facing: { x: -1, y: 0 },
      tags: ["player", "tdm", "greybox"],
    }),
  ],
  pickupSpawns: [
    { id: "armor-center", type: "armor", position: { x: 1100, y: 450 } },
    { id: "armor-left", type: "armor", position: { x: 680, y: 450 } },
    { id: "armor-right", type: "armor", position: { x: 1520, y: 450 } },
    { id: "health-upper-left", type: "health", position: { x: 650, y: 115 } },
    { id: "health-upper-right", type: "health", position: { x: 1550, y: 115 } },
    { id: "health-lower-left", type: "health", position: { x: 650, y: 785 } },
    { id: "health-lower-right", type: "health", position: { x: 1550, y: 785 } },
    { id: "rocket-upper-left", type: "rocket", position: { x: 720, y: 230 } },
    { id: "rocket-upper-right", type: "rocket", position: { x: 1480, y: 230 } },
    { id: "rocket-lower-left", type: "rocket", position: { x: 720, y: 670 } },
    { id: "rocket-lower-right", type: "rocket", position: { x: 1480, y: 670 } },
    { id: "rail-upper", type: "rail", position: { x: 1100, y: 90 } },
    { id: "rail-lower", type: "rail", position: { x: 1100, y: 835 } },
    { id: "whip-lower-left", type: "whip", position: { x: 900, y: 790 } },
    { id: "whip-lower-right", type: "whip", position: { x: 1300, y: 790 } },
  ],
  gameplay: {
    blueBase: { x: 55, y: 300, width: 230, height: 300 },
    redBase: { x: 1915, y: 300, width: 230, height: 300 },
    combatZone: { x: 930, y: 330, width: 340, height: 240 },
  },
  presentation: {
    theme: "ruins",
    plan: "Symmetric greybox with three readable routes, broad cross-lane rotations, bounded sightlines, and weapon-specific combat pockets.",
    walls,
    gaps,
    botRoutes: {
      attacker: [
        { x: 2020, y: 175 }, { x: 1700, y: 175 },
        { x: 1420, y: 175 }, { x: 1100, y: 120 },
        { x: 780, y: 175 }, { x: 500, y: 175 },
        { x: 180, y: 450 },
      ],
      defender: [
        { x: 1970, y: 235 }, { x: 2100, y: 320 },
        { x: 2100, y: 580 }, { x: 1970, y: 665 },
      ],
    },
  },
  diagnosticSpawn: { x: 2050, y: 450 },
};
