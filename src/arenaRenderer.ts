import Phaser from "phaser";
import { T, TEAM } from "./config";
import {
  LEVEL_THEME_VISUALS,
  type LevelData,
  type LevelDecoration,
  type LevelGap,
  type LevelWall,
} from "./level";
import type { Rect } from "./math";

export function renderArena(
  scene: Phaser.Scene,
  level: LevelData,
  onLibraryTable: (x: number, y: number) => void,
) {
  const g = scene.add.graphics().setDepth(0);
  const visuals = LEVEL_THEME_VISUALS[level.theme];
  drawFloorTiles(scene, level);
  if (level.theme === "library" && level.combatZone) {
    const r = level.combatZone;
    scene.add.image(r.x + r.w / 2, r.y + r.h / 2, "libraryFloorCarpet")
      .setDisplaySize(r.w, r.h)
      .setAlpha(.78)
      .setDepth(-1.8);
  }
  if (level.theme === "ruins") {
    if (level.combatZone) {
      const r = level.combatZone;
      scene.add.image(r.x + r.w / 2, r.y + r.h / 2, "ruinsCombatCourt")
        .setDisplaySize(r.w, r.h)
        .setDepth(-1.7);
    }
    drawRuinsBase(scene, level.redBase, "ruinsBaseRed");
    drawRuinsBase(scene, level.blueBase, "ruinsBaseBlue");
  } else {
    drawObjectSprite(scene, level.redBase, visuals.redBase, .92);
    drawObjectSprite(scene, level.blueBase, visuals.blueBase, .92);
  }
  if (level.theme === "library") {
    for (const decoration of level.decorations ?? []) drawLibraryDecoration(scene, g, decoration);
    for (const gap of level.gaps) drawLibraryGap(scene, g, gap);
    for (const wall of level.walls) drawLibraryWall(scene, g, wall, onLibraryTable);
  } else if (level.theme === "ruins") {
    for (const gap of level.gaps) drawRuinsGap(scene, gap);
    for (const wall of level.walls) drawRuinsWall(scene, g, wall);
  } else {
    for (const gap of level.gaps) drawObjectSprite(scene, gap, visuals.gap, 1);
    for (const wall of level.walls) {
      drawObjectSprite(scene, wall, wall.w > wall.h ? visuals.wallHorizontal : visuals.wallVertical, 1);
    }
  }

  if (level.theme !== "ruins") {
    g.lineStyle(1, 0xcadbd4, .28);
    for (let x = 0; x <= T.worldWidth; x += 50) g.beginPath().moveTo(x, 0).lineTo(x, T.worldHeight).strokePath();
    for (let y = 0; y <= T.worldHeight; y += 50) g.beginPath().moveTo(0, y).lineTo(T.worldWidth, y).strokePath();
    drawZone(g, level.redBase, TEAM.red.base, TEAM.red.dark);
    drawZone(g, level.blueBase, TEAM.blue.base, TEAM.blue.dark);
    if (level.combatZone) drawCombatZone(g, level.combatZone, level.theme === "library");
    g.lineStyle(3, 0x9dafaa, .45).beginPath().moveTo(T.worldWidth / 2, 40).lineTo(T.worldWidth / 2, T.worldHeight - 40).strokePath();
  }
}

function drawFloorTiles(scene: Phaser.Scene, level: LevelData) {
  if (level.theme === "ruins") {
    const size = 160;
    for (let y = 0; y < T.worldHeight; y += size) {
      for (let x = 0; x < T.worldWidth; x += size) {
        scene.add.image(x + size / 2, y + size / 2, "ruinsFloorStone")
          .setDisplaySize(size, size)
          .setDepth(-2);
      }
    }
    return;
  }
  const size = 50;
  const visuals = LEVEL_THEME_VISUALS[level.theme];
  for (let y = 0; y < T.worldHeight; y += size) {
    for (let x = 0; x < T.worldWidth; x += size) {
      if (level.theme === "library") {
        const gallery = y < 165 || y >= T.worldHeight - 165;
        const key = gallery ? "libraryFloorWood" : "libraryFloorStone";
        scene.add.image(x + size / 2, y + size / 2, key).setDisplaySize(size, size).setDepth(-2);
        continue;
      }
      const frame = (Math.floor(x / size) + Math.floor(y / size) * 2) % 7 === 0
        ? visuals.floorAccent
        : visuals.floorPrimary;
      scene.add.image(x + size / 2, y + size / 2, "arenaTiles", frame).setDisplaySize(size, size).setDepth(-2);
    }
  }
}

function drawObjectSprite(scene: Phaser.Scene, r: Rect, frame: number, alpha = 1) {
  scene.add.image(r.x + r.w / 2, r.y + r.h / 2, "arenaTiles", frame)
    .setDisplaySize(r.w, r.h)
    .setAlpha(alpha)
    .setDepth(-1);
}

function drawZone(g: Phaser.GameObjects.Graphics, r: Rect, fill: number, stroke: number) {
  g.fillStyle(fill, .18)
    .fillRoundedRect(r.x, r.y, r.w, r.h, 8)
    .lineStyle(3, stroke, .62)
    .strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
}

function drawCombatZone(g: Phaser.GameObjects.Graphics, r: Rect, library: boolean) {
  g.fillStyle(library ? 0x7a2736 : 0xdff6ef, library ? .08 : .13).fillRoundedRect(r.x, r.y, r.w, r.h, 24);
  g.lineStyle(2, library ? 0xb58b58 : 0x4d887d, library ? .3 : .34).strokeRoundedRect(r.x, r.y, r.w, r.h, 24);
  g.lineStyle(1, 0xffffff, .3).strokeCircle(r.x + r.w / 2, r.y + r.h / 2, 76);
}

function drawRuinsWall(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, wall: LevelWall) {
  const horizontal = wall.w > wall.h;
  g.fillStyle(0x18201d, .2).fillRoundedRect(wall.x + 5, wall.y + 8, wall.w, wall.h, 7);
  scene.add.image(
    wall.x + wall.w / 2,
    wall.y + wall.h / 2,
    horizontal ? "ruinsWallHorizontal" : "ruinsWallVertical",
  )
    .setDisplaySize(wall.w + (horizontal ? 14 : 18), wall.h + (horizontal ? 18 : 14))
    .setDepth(2);
}

function drawRuinsGap(scene: Phaser.Scene, gap: LevelGap) {
  scene.add.image(gap.x + gap.w / 2, gap.y + gap.h / 2, "ruinsGapChasm")
    .setDisplaySize(gap.w, gap.h)
    .setDepth(1);
}

function drawRuinsBase(scene: Phaser.Scene, base: Rect, key: "ruinsBaseRed" | "ruinsBaseBlue") {
  scene.add.image(base.x + base.w / 2, base.y + base.h / 2, key)
    .setDisplaySize(base.w + 8, base.h + 8)
    .setDepth(-1);
}

function drawLibraryWall(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  wall: LevelWall,
  onLibraryTable: (x: number, y: number) => void,
) {
  const table = wall.visual === "reading-table";
  g.fillStyle(0x17120f, .18).fillRoundedRect(wall.x + 5, wall.y + 7, wall.w, wall.h, 7);
  if (table) {
    const x = wall.x + wall.w / 2;
    const y = wall.y + wall.h / 2;
    scene.add.image(x, y, "libraryRoundTable")
      .setDisplaySize(wall.w + 10, wall.h + 10)
      .setDepth(2);
    onLibraryTable(x, y);
    return;
  }
  const horizontal = wall.w > wall.h;
  const key = wall.visual === "bookshelf-damaged"
    ? "libraryShelfDamaged"
    : horizontal ? "libraryShelfHorizontal" : "libraryShelfVertical";
  scene.add.image(wall.x + wall.w / 2, wall.y + wall.h / 2, key)
    .setDisplaySize(wall.w + (horizontal ? 8 : 4), wall.h + (horizontal ? 4 : 8))
    .setDepth(2);
}

function drawLibraryGap(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, gap: LevelGap) {
  g.fillStyle(0x090707, .66).fillRoundedRect(gap.x + 3, gap.y + 5, gap.w, gap.h, 8);
  scene.add.image(gap.x + gap.w / 2, gap.y + gap.h / 2, "libraryCollapsedFloor")
    .setDisplaySize(gap.w + 12, gap.h + 12)
    .setDepth(1);
}

function drawLibraryDecoration(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, decoration: LevelDecoration) {
  if (decoration.kind === "rug") {
    scene.add.image(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, "libraryRug")
      .setDisplaySize(decoration.w, decoration.h)
      .setAlpha(.88)
      .setDepth(-.5);
  } else if (decoration.kind === "book-pile") {
    scene.add.image(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, "libraryBooks")
      .setDisplaySize(decoration.w, decoration.h)
      .setDepth(1);
  } else if (decoration.kind === "cobweb-spider") {
    scene.add.image(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, "libraryCobweb")
      .setDisplaySize(decoration.w, decoration.h)
      .setAlpha(.66)
      .setDepth(1);
  } else if (decoration.kind === "reading-lamp") {
    g.fillStyle(0xffdf8a, .18).fillCircle(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, 24);
    g.fillStyle(0xffd36c, .86).fillCircle(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, 6);
  }
}
