import type { Rect } from "./math";

export type PickupKind = "health" | "armor" | "rocket" | "rail";
export type PickupSpawn = { kind: PickupKind; x: number; y: number };
export type LevelTheme = "ruins" | "library" | "sports";
export type WallVisual = "stone-wall" | "bookshelf" | "bookshelf-damaged" | "reading-table" | "sports-barrier";
export type GapVisual = "chasm" | "collapsed-floor" | "maintenance-pit";
export type DecorationKind = "rug" | "book-pile" | "reading-lamp" | "cobweb-spider" | "field-marking";
export type LevelWall = Rect & { visual?: WallVisual };
export type LevelGap = Rect & { visual?: GapVisual };
export type LevelDecoration = Rect & { kind: DecorationKind };

export const LEVEL_THEME_VISUALS = {
  ruins: { floorPrimary: 0, floorAccent: 1, redBase: 2, blueBase: 3, wallHorizontal: 4, wallVertical: 5, gap: 8 },
  library: { floorPrimary: 0, floorAccent: 1, redBase: 2, blueBase: 3, wallHorizontal: 4, wallVertical: 5, gap: 8 },
  sports: { floorPrimary: 0, floorAccent: 1, redBase: 2, blueBase: 3, wallHorizontal: 4, wallVertical: 5, gap: 8 },
} as const;

export type LevelData = {
  id: string;
  name: string;
  plan: string;
  theme: LevelTheme;
  redSpawn: { x: number; y: number };
  blueSpawn: { x: number; y: number };
  redBase: Rect;
  blueBase: Rect;
  redFlag: { x: number; y: number };
  blueFlag: { x: number; y: number };
  walls: LevelWall[];
  gaps: LevelGap[];
  decorations?: LevelDecoration[];
  combatZone?: Rect;
  pickups: PickupSpawn[];
  botRoutes: {
    attacker: { x: number; y: number }[];
    defender: { x: number; y: number }[];
  };
};

const trainingCrossing: LevelData = {
  id: "training-crossing",
  name: "Training Crossing",
  plan: "Balanced starter arena with a contested central power-up court and clear jump flanks.",
  theme: "ruins",
  redSpawn: { x: 150, y: 410 },
  blueSpawn: { x: 1350, y: 410 },
  redBase: { x: 70, y: 280, w: 190, h: 260 },
  blueBase: { x: 1240, y: 280, w: 190, h: 260 },
  redFlag: { x: 150, y: 410 },
  blueFlag: { x: 1350, y: 410 },
  walls: [
    { x: 320, y: 112, w: 60, h: 194 }, { x: 320, y: 514, w: 60, h: 194 },
    { x: 1120, y: 112, w: 60, h: 194 }, { x: 1120, y: 514, w: 60, h: 194 },
    { x: 458, y: 328, w: 60, h: 164 }, { x: 982, y: 328, w: 60, h: 164 },
    { x: 620, y: 88, w: 260, h: 52 }, { x: 620, y: 680, w: 260, h: 52 },
    { x: 612, y: 306, w: 64, h: 64 }, { x: 824, y: 450, w: 64, h: 64 },
  ] satisfies Rect[],
  gaps: [
    { x: 548, y: 214, w: 128, h: 72 }, { x: 824, y: 534, w: 128, h: 72 },
  ] satisfies Rect[],
  combatZone: { x: 600, y: 288, w: 300, h: 244 },
  pickups: [
    { kind: "health", x: 120, y: 320 }, { kind: "armor", x: 220, y: 320 }, { kind: "rocket", x: 130, y: 500 }, { kind: "rail", x: 215, y: 500 },
    { kind: "health", x: 1290, y: 320 }, { kind: "armor", x: 1390, y: 320 }, { kind: "rocket", x: 1370, y: 500 }, { kind: "rail", x: 1285, y: 500 },
    { kind: "armor", x: 750, y: 410 },
  ],
  botRoutes: {
    attacker: [{ x: 1160, y: 72 }, { x: 900, y: 62 }, { x: 600, y: 62 }, { x: 340, y: 72 }, { x: 150, y: 410 }],
    defender: [{ x: 1180, y: 280 }, { x: 1340, y: 280 }, { x: 1340, y: 540 }, { x: 1180, y: 540 }],
  },
};

const midlineRush: LevelData = {
  id: "midline-rush",
  name: "Grand Archive",
  plan: "A fast library arena with broad gallery lanes, an open reading hall, cross-passages, and collapsed-floor jump shortcuts.",
  theme: "library",
  redSpawn: { x: 145, y: 410 },
  blueSpawn: { x: 1355, y: 410 },
  redBase: { x: 65, y: 285, w: 195, h: 250 },
  blueBase: { x: 1240, y: 285, w: 195, h: 250 },
  redFlag: { x: 150, y: 410 },
  blueFlag: { x: 1350, y: 410 },
  walls: [
    { x: 330, y: 92, w: 58, h: 188, visual: "bookshelf" },
    { x: 330, y: 540, w: 58, h: 188, visual: "bookshelf" },
    { x: 1112, y: 92, w: 58, h: 188, visual: "bookshelf" },
    { x: 1112, y: 540, w: 58, h: 188, visual: "bookshelf" },
    { x: 470, y: 176, w: 190, h: 52, visual: "bookshelf-damaged" },
    { x: 840, y: 176, w: 190, h: 52, visual: "bookshelf" },
    { x: 470, y: 592, w: 190, h: 52, visual: "bookshelf" },
    { x: 840, y: 592, w: 190, h: 52, visual: "bookshelf-damaged" },
    { x: 612, y: 314, w: 76, h: 76, visual: "reading-table" },
    { x: 812, y: 430, w: 76, h: 76, visual: "reading-table" },
  ],
  gaps: [
    { x: 682, y: 190, w: 136, h: 66, visual: "collapsed-floor" },
    { x: 682, y: 564, w: 136, h: 66, visual: "collapsed-floor" },
  ],
  decorations: [
    { kind: "rug", x: 564, y: 292, w: 172, h: 120 },
    { kind: "rug", x: 764, y: 408, w: 172, h: 120 },
    { kind: "book-pile", x: 422, y: 320, w: 38, h: 38 },
    { kind: "book-pile", x: 1040, y: 462, w: 38, h: 38 },
    { kind: "cobweb-spider", x: 392, y: 96, w: 72, h: 58 },
    { kind: "cobweb-spider", x: 1038, y: 666, w: 72, h: 58 },
  ],
  combatZone: { x: 552, y: 270, w: 396, h: 280 },
  pickups: [
    { kind: "health", x: 112, y: 325 }, { kind: "armor", x: 215, y: 325 }, { kind: "rocket", x: 125, y: 500 }, { kind: "rail", x: 215, y: 500 },
    { kind: "health", x: 1285, y: 325 }, { kind: "armor", x: 1388, y: 325 }, { kind: "rocket", x: 1375, y: 500 }, { kind: "rail", x: 1285, y: 500 },
    { kind: "health", x: 750, y: 410 },
  ],
  botRoutes: {
    attacker: [{ x: 1150, y: 760 }, { x: 900, y: 752 }, { x: 600, y: 752 }, { x: 350, y: 760 }, { x: 150, y: 410 }],
    defender: [{ x: 1210, y: 285 }, { x: 1375, y: 300 }, { x: 1375, y: 520 }, { x: 1210, y: 535 }],
  },
};

const flankSwitch: LevelData = {
  id: "flank-switch",
  name: "Flank Switch",
  plan: "More technical map with curved wall gates, tight passages, and diagonal-feeling gap decisions.",
  theme: "sports",
  redSpawn: { x: 150, y: 410 },
  blueSpawn: { x: 1350, y: 410 },
  redBase: { x: 75, y: 275, w: 190, h: 270 },
  blueBase: { x: 1235, y: 275, w: 190, h: 270 },
  redFlag: { x: 150, y: 410 },
  blueFlag: { x: 1350, y: 410 },
  walls: [
    { x: 330, y: 150, w: 210, h: 36 }, { x: 330, y: 634, w: 210, h: 36 },
    { x: 960, y: 150, w: 210, h: 36 }, { x: 960, y: 634, w: 210, h: 36 },
    { x: 475, y: 250, w: 42, h: 150 }, { x: 475, y: 420, w: 42, h: 150 },
    { x: 983, y: 250, w: 42, h: 150 }, { x: 983, y: 420, w: 42, h: 150 },
    { x: 672, y: 145, w: 46, h: 210 }, { x: 782, y: 465, w: 46, h: 210 },
    { x: 660, y: 392, w: 180, h: 36 },
  ],
  gaps: [
    { x: 585, y: 235, w: 128, h: 70 }, { x: 787, y: 515, w: 128, h: 70 },
    { x: 585, y: 515, w: 128, h: 70 }, { x: 787, y: 235, w: 128, h: 70 },
    { x: 706, y: 338, w: 88, h: 144 },
  ],
  pickups: [
    { kind: "health", x: 125, y: 315 }, { kind: "armor", x: 220, y: 315 }, { kind: "rocket", x: 125, y: 505 }, { kind: "rail", x: 215, y: 505 },
    { kind: "health", x: 1280, y: 315 }, { kind: "armor", x: 1375, y: 315 }, { kind: "rocket", x: 1375, y: 505 }, { kind: "rail", x: 1285, y: 505 },
  ],
  botRoutes: {
    attacker: [{ x: 1180, y: 720 }, { x: 930, y: 720 }, { x: 750, y: 720 }, { x: 520, y: 720 }, { x: 150, y: 410 }],
    defender: [{ x: 1200, y: 250 }, { x: 1380, y: 330 }, { x: 1380, y: 500 }, { x: 1200, y: 590 }],
  },
};

export const LEVELS = [trainingCrossing, midlineRush, flankSwitch] as const;
export type LevelId = typeof LEVELS[number]["id"];
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((level) => [level.id, level])) as Record<LevelId, LevelData>;
export const LEVEL = trainingCrossing;
