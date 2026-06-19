import type { WorldMapData } from "./worldMapData";
import { createTeamSpawnPoints } from "./createTeamSpawnPoints";

export const TRAINING_CROSSING_V2: WorldMapData = {
  id: "training-crossing-v2",
  displayName: "Training Crossing",
  geometry: {
    bounds: {
      minX: 0,
      minY: 0,
      maxX: 1500,
      maxY: 820,
    },
    solids: [
      { id: "wall-01", x: 320, y: 112, width: 60, height: 194 },
      { id: "wall-02", x: 320, y: 514, width: 60, height: 194 },
      { id: "wall-03", x: 1120, y: 112, width: 60, height: 194 },
      { id: "wall-04", x: 1120, y: 514, width: 60, height: 194 },
      { id: "wall-05", x: 458, y: 328, width: 60, height: 164 },
      { id: "wall-06", x: 982, y: 328, width: 60, height: 164 },
      { id: "wall-07", x: 620, y: 88, width: 260, height: 52 },
      { id: "wall-08", x: 620, y: 680, width: 260, height: 52 },
      { id: "wall-09", x: 612, y: 306, width: 64, height: 64 },
      { id: "wall-10", x: 824, y: 450, width: 64, height: 64 },
    ],
    gaps: [
      { id: "gap-01", x: 548, y: 214, width: 128, height: 72 },
      { id: "gap-02", x: 824, y: 534, width: 128, height: 72 },
    ],
  },
  navigation: {
    jumpLinks: [
      {
        id: "gap-01-north-south",
        from: { x: 612, y: 180 },
        to: { x: 612, y: 320 },
        activationRadius: 44,
      },
      {
        id: "gap-01-south-north",
        from: { x: 612, y: 320 },
        to: { x: 612, y: 180 },
        activationRadius: 44,
      },
      {
        id: "gap-02-north-south",
        from: { x: 888, y: 500 },
        to: { x: 888, y: 640 },
        activationRadius: 44,
      },
      {
        id: "gap-02-south-north",
        from: { x: 888, y: 640 },
        to: { x: 888, y: 500 },
        activationRadius: 44,
      },
    ],
  },
  spawnPoints: [
    ...createTeamSpawnPoints({
      teamId: "blue",
      position: { x: 1350, y: 410 },
      facing: { x: -1, y: 0 },
      tags: ["player", "diagnostic"],
    }),
    {
      id: "red-target-spawn-1",
      teamId: "red",
      position: { x: 260, y: 410 },
      facing: { x: -1, y: 0 },
      tags: ["target", "diagnostic"],
    },
    {
      id: "red-target-spawn-2",
      teamId: "red",
      position: { x: 260, y: 290 },
      facing: { x: -1, y: 0 },
      tags: ["target", "diagnostic"],
    },
    {
      id: "red-target-spawn-3",
      teamId: "red",
      position: { x: 260, y: 530 },
      facing: { x: -1, y: 0 },
      tags: ["target", "diagnostic"],
    },
    ...createTeamSpawnPoints({
      teamId: "red",
      position: { x: 150, y: 410 },
      facing: { x: 1, y: 0 },
      tags: ["player", "tdm"],
    }),
  ],
  pickupSpawns: [
    { id: "health-red", type: "health", position: { x: 120, y: 320 } },
    { id: "armor-red", type: "armor", position: { x: 220, y: 320 } },
    { id: "health-blue", type: "health", position: { x: 1290, y: 320 } },
    { id: "armor-blue", type: "armor", position: { x: 1390, y: 320 } },
    { id: "armor-center", type: "armor", position: { x: 750, y: 410 } },
    { id: "rocket-red", type: "rocket", position: { x: 130, y: 500 } },
    { id: "rail-red", type: "rail", position: { x: 215, y: 500 } },
    { id: "whip-red", type: "whip", position: { x: 285, y: 410 } },
    { id: "rocket-blue", type: "rocket", position: { x: 1370, y: 500 } },
    { id: "rail-blue", type: "rail", position: { x: 1285, y: 500 } },
    { id: "whip-blue", type: "whip", position: { x: 1215, y: 410 } },
  ],
  gameplay: {
    redBase: { x: 70, y: 280, width: 190, height: 260 },
    blueBase: { x: 1240, y: 280, width: 190, height: 260 },
    combatZone: { x: 600, y: 288, width: 300, height: 244 },
  },
  presentation: {
    theme: "ruins",
    plan: "Balanced starter arena with a contested central power-up court and clear jump flanks.",
    walls: [
      { x: 320, y: 112, width: 60, height: 194 },
      { x: 320, y: 514, width: 60, height: 194 },
      { x: 1120, y: 112, width: 60, height: 194 },
      { x: 1120, y: 514, width: 60, height: 194 },
      { x: 458, y: 328, width: 60, height: 164 },
      { x: 982, y: 328, width: 60, height: 164 },
      { x: 620, y: 88, width: 260, height: 52 },
      { x: 620, y: 680, width: 260, height: 52 },
      { x: 612, y: 306, width: 64, height: 64 },
      { x: 824, y: 450, width: 64, height: 64 },
    ],
    gaps: [
      { x: 548, y: 214, width: 128, height: 72 },
      { x: 824, y: 534, width: 128, height: 72 },
    ],
    decorations: [
      { kind: "ruins-banner-red", x: 0, y: 358, width: 64, height: 104 },
      { kind: "ruins-banner-blue", x: 1436, y: 358, width: 64, height: 104 },
      { kind: "ruins-column", x: 8, y: 8, width: 112, height: 112 },
      { kind: "ruins-column", x: 1380, y: 700, width: 112, height: 112 },
      { kind: "ruins-overgrowth", x: 390, y: 0, width: 176, height: 74 },
      { kind: "ruins-overgrowth", x: 934, y: 746, width: 176, height: 74 },
      { kind: "ruins-overgrowth", x: 390, y: 746, width: 176, height: 74 },
      { kind: "ruins-overgrowth", x: 934, y: 0, width: 176, height: 74 },
    ],
    botRoutes: {
      attacker: [
        { x: 1160, y: 72 }, { x: 900, y: 62 },
        { x: 600, y: 62 }, { x: 340, y: 72 },
        { x: 150, y: 410 },
      ],
      defender: [
        { x: 1180, y: 280 }, { x: 1340, y: 280 },
        { x: 1340, y: 540 }, { x: 1180, y: 540 },
      ],
    },
  },
  diagnosticSpawn: { x: 150, y: 410 },
};
