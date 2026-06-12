import type { WorldMapData } from "./worldMapData";

export const TRAINING_CROSSING_V2: WorldMapData = {
  id: "training-crossing-v2",
  displayName: "Training Crossing V2 Geometry",
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
  spawnPoints: [
    {
      id: "blue-player-spawn",
      teamId: "blue",
      position: { x: 150, y: 410 },
      facing: { x: 1, y: 0 },
      tags: ["player", "diagnostic"],
    },
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
    {
      id: "red-player-spawn",
      teamId: "red",
      position: { x: 260, y: 300 },
      facing: { x: -1, y: 0 },
      tags: ["player", "tdm"],
    },
  ],
  diagnosticSpawn: { x: 150, y: 410 },
};
