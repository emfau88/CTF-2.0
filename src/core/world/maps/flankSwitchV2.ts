import type { WorldMapData } from "./worldMapData";

const walls = [
  { x: 330, y: 92, width: 52, height: 228, visual: "industrial-barrier" },
  { x: 330, y: 500, width: 52, height: 228, visual: "industrial-barrier" },
  { x: 2118, y: 92, width: 52, height: 228, visual: "industrial-barrier" },
  { x: 2118, y: 500, width: 52, height: 228, visual: "industrial-barrier" },
  { x: 530, y: 270, width: 310, height: 44, visual: "industrial-barrier" },
  { x: 530, y: 506, width: 310, height: 44, visual: "industrial-barrier" },
  { x: 1660, y: 270, width: 310, height: 44, visual: "industrial-barrier" },
  { x: 1660, y: 506, width: 310, height: 44, visual: "industrial-barrier" },
  { x: 920, y: 88, width: 48, height: 180, visual: "industrial-barrier" },
  { x: 920, y: 552, width: 48, height: 180, visual: "industrial-barrier" },
  { x: 1532, y: 88, width: 48, height: 180, visual: "industrial-barrier" },
  { x: 1532, y: 552, width: 48, height: 180, visual: "industrial-barrier" },
  { x: 1080, y: 334, width: 150, height: 42, visual: "industrial-barrier" },
  { x: 1270, y: 444, width: 150, height: 42, visual: "industrial-barrier" },
] as const;

const gaps = [
  { x: 1015, y: 150, width: 130, height: 68, visual: "maintenance-pit" },
  { x: 1355, y: 150, width: 130, height: 68, visual: "maintenance-pit" },
  { x: 1015, y: 602, width: 130, height: 68, visual: "maintenance-pit" },
  { x: 1355, y: 602, width: 130, height: 68, visual: "maintenance-pit" },
] as const;

export const FLANK_SWITCH_V2: WorldMapData = {
  id: "flank-switch-v2",
  displayName: "Flank Switch",
  geometry: {
    bounds: { minX: 0, minY: 0, maxX: 2500, maxY: 820 },
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
        id: "gap-01-north-south",
        from: { x: 1080, y: 116 },
        to: { x: 1080, y: 252 },
        activationRadius: 44,
      },
      {
        id: "gap-01-south-north",
        from: { x: 1080, y: 252 },
        to: { x: 1080, y: 116 },
        activationRadius: 44,
      },
      {
        id: "gap-02-north-south",
        from: { x: 1420, y: 116 },
        to: { x: 1420, y: 252 },
        activationRadius: 44,
      },
      {
        id: "gap-02-south-north",
        from: { x: 1420, y: 252 },
        to: { x: 1420, y: 116 },
        activationRadius: 44,
      },
      {
        id: "gap-03-north-south",
        from: { x: 1080, y: 568 },
        to: { x: 1080, y: 704 },
        activationRadius: 44,
      },
      {
        id: "gap-03-south-north",
        from: { x: 1080, y: 704 },
        to: { x: 1080, y: 568 },
        activationRadius: 44,
      },
      {
        id: "gap-04-north-south",
        from: { x: 1420, y: 568 },
        to: { x: 1420, y: 704 },
        activationRadius: 44,
      },
      {
        id: "gap-04-south-north",
        from: { x: 1420, y: 704 },
        to: { x: 1420, y: 568 },
        activationRadius: 44,
      },
    ],
  },
  spawnPoints: [
    {
      id: "blue-player-spawn",
      teamId: "blue",
      position: { x: 2350, y: 410 },
      facing: { x: -1, y: 0 },
      tags: ["player", "tdm"],
    },
    {
      id: "red-player-spawn",
      teamId: "red",
      position: { x: 150, y: 410 },
      facing: { x: 1, y: 0 },
      tags: ["player", "tdm"],
    },
  ],
  pickupSpawns: [
    { id: "health-red", type: "health", position: { x: 125, y: 315 } },
    { id: "armor-red", type: "armor", position: { x: 220, y: 315 } },
    { id: "rocket-red", type: "rocket", position: { x: 125, y: 505 } },
    { id: "rail-red", type: "rail", position: { x: 215, y: 505 } },
    { id: "health-blue", type: "health", position: { x: 2280, y: 315 } },
    { id: "armor-blue", type: "armor", position: { x: 2375, y: 315 } },
    { id: "rocket-blue", type: "rocket", position: { x: 2375, y: 505 } },
    { id: "rail-blue", type: "rail", position: { x: 2285, y: 505 } },
    { id: "whip-red", type: "whip", position: { x: 285, y: 410 } },
    { id: "whip-blue", type: "whip", position: { x: 2215, y: 410 } },
    { id: "health-left", type: "health", position: { x: 820, y: 410 } },
    { id: "health-right", type: "health", position: { x: 1680, y: 410 } },
    { id: "rail-top", type: "rail", position: { x: 1250, y: 105 } },
    { id: "rocket-bottom", type: "rocket", position: { x: 1250, y: 715 } },
    { id: "armor-center", type: "armor", position: { x: 1250, y: 410 } },
  ],
  gameplay: {
    redBase: { x: 75, y: 275, width: 190, height: 270 },
    blueBase: { x: 2235, y: 275, width: 190, height: 270 },
    combatZone: { x: 1050, y: 274, width: 400, height: 272 },
  },
  presentation: {
    theme: "industrial",
    plan: "A wide industrial switchyard with three distinct routes, cross-lane switches, and longer flag runs.",
    walls,
    gaps,
    decorations: [
      { kind: "industrial-energy-red", x: 280, y: 388, width: 780, height: 44 },
      { kind: "industrial-energy-blue", x: 1440, y: 388, width: 780, height: 44 },
      { kind: "industrial-edge-pipes", x: 410, y: -12, width: 620, height: 94 },
      { kind: "industrial-edge-pipes", x: 1470, y: 738, width: 620, height: 94 },
      { kind: "industrial-edge-tank", x: 60, y: -34, width: 128, height: 160 },
      { kind: "industrial-edge-tank", x: 2312, y: 694, width: 128, height: 160 },
      { kind: "industrial-edge-turbine", x: 1168, y: -42, width: 164, height: 164 },
      { kind: "industrial-edge-turbine", x: 1168, y: 698, width: 164, height: 164 },
    ],
    botRoutes: {
      attacker: [
        { x: 2150, y: 690 }, { x: 1880, y: 690 },
        { x: 1580, y: 690 }, { x: 1250, y: 690 },
        { x: 920, y: 690 }, { x: 620, y: 690 },
        { x: 350, y: 690 }, { x: 150, y: 410 },
      ],
      defender: [
        { x: 2185, y: 250 }, { x: 2390, y: 310 },
        { x: 2390, y: 510 }, { x: 2185, y: 570 },
      ],
    },
  },
  diagnosticSpawn: { x: 150, y: 410 },
};
