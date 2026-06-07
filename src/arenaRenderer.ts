import Phaser from "phaser";
import { TEAM } from "./config";
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
  }
  if (level.theme === "industrial" && level.combatZone) {
    const r = level.combatZone;
    scene.add.image(r.x + r.w / 2, r.y + r.h / 2, "industrialEnergyJunction")
      .setDisplaySize(r.w, r.h)
      .setDepth(-1.7);
  }
  if (level.theme === "ruins" || level.theme === "library") {
    const baseDepth = level.theme === "library" ? .5 : -1;
    drawRuinsBase(scene, level.redBase, "ruinsBaseRed", baseDepth);
    drawRuinsBase(scene, level.blueBase, "ruinsBaseBlue", baseDepth);
  } else if (level.theme === "industrial") {
    drawIndustrialBase(scene, level.redBase, "industrialBaseRed");
    drawIndustrialBase(scene, level.blueBase, "industrialBaseBlue");
  } else {
    drawObjectSprite(scene, level.redBase, visuals.redBase, .92);
    drawObjectSprite(scene, level.blueBase, visuals.blueBase, .92);
  }
  if (level.theme === "library") {
    for (const decoration of level.decorations ?? []) drawLibraryDecoration(scene, g, decoration);
    for (const gap of level.gaps) drawLibraryGap(scene, g, gap);
    for (const wall of level.walls) drawLibraryWall(scene, g, wall, onLibraryTable);
  } else if (level.theme === "ruins") {
    ensureRuinsAnimations(scene);
    for (const decoration of level.decorations ?? []) drawRuinsDecoration(scene, decoration);
    for (const gap of level.gaps) drawRuinsGap(scene, gap);
    for (const wall of level.walls) drawRuinsWall(scene, g, wall);
  } else if (level.theme === "industrial") {
    for (const decoration of level.decorations ?? []) drawIndustrialDecoration(scene, decoration);
    for (const gap of level.gaps) drawIndustrialGap(scene, gap);
    for (const wall of level.walls) drawIndustrialWall(scene, g, wall);
  } else {
    for (const gap of level.gaps) drawObjectSprite(scene, gap, visuals.gap, 1);
    for (const wall of level.walls) {
      drawObjectSprite(scene, wall, wall.w > wall.h ? visuals.wallHorizontal : visuals.wallVertical, 1);
    }
  }

  if (level.theme === "library") {
    drawZone(g, level.redBase, TEAM.red.base, TEAM.red.dark);
    drawZone(g, level.blueBase, TEAM.blue.base, TEAM.blue.dark);
  }
}

function drawFloorTiles(scene: Phaser.Scene, level: LevelData) {
  if (level.theme === "ruins") {
    const size = 160;
    for (let y = 0; y < level.height; y += size) {
      for (let x = 0; x < level.width; x += size) {
        scene.add.image(x + size / 2, y + size / 2, "ruinsFloorStone")
          .setDisplaySize(size, size)
          .setDepth(-2);
      }
    }
    return;
  }
  if (level.theme === "industrial") {
    const size = 256;
    for (let y = 0; y < level.height; y += size) {
      for (let x = 0; x < level.width; x += size) {
        scene.add.image(x + size / 2, y + size / 2, "industrialFloorMetal")
          .setDisplaySize(size, size)
          .setDepth(-2);
      }
    }
    return;
  }
  const size = 50;
  const visuals = LEVEL_THEME_VISUALS[level.theme];
  for (let y = 0; y < level.height; y += size) {
    for (let x = 0; x < level.width; x += size) {
      if (level.theme === "library") {
        const gallery = y < 165 || y >= level.height - 165;
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

function drawIndustrialBase(
  scene: Phaser.Scene,
  base: Rect,
  key: "industrialBaseRed" | "industrialBaseBlue",
) {
  scene.add.image(base.x + base.w / 2, base.y + base.h / 2, key)
    .setDisplaySize(base.w + 8, base.h + 8)
    .setDepth(-.5);
}

function drawIndustrialWall(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, wall: LevelWall) {
  const horizontal = wall.w > wall.h;
  g.fillStyle(0x080d12, .32).fillRoundedRect(wall.x + 5, wall.y + 7, wall.w, wall.h, 6);
  scene.add.image(
    wall.x + wall.w / 2,
    wall.y + wall.h / 2,
    horizontal ? "industrialWallHorizontal" : "industrialWallVertical",
  )
    .setDisplaySize(wall.w + (horizontal ? 12 : 10), wall.h + (horizontal ? 12 : 10))
    .setDepth(2);
}

function drawIndustrialGap(scene: Phaser.Scene, gap: LevelGap) {
  scene.add.image(gap.x + gap.w / 2, gap.y + gap.h / 2, "industrialMaintenancePit")
    .setDisplaySize(gap.w + 8, gap.h + 8)
    .setDepth(1);
}

function drawIndustrialDecoration(scene: Phaser.Scene, decoration: LevelDecoration) {
  const x = decoration.x + decoration.w / 2;
  const y = decoration.y + decoration.h / 2;

  if (decoration.kind === "industrial-switch-gate") {
    scene.add.image(x, y, "industrialSwitchGate")
      .setDisplaySize(decoration.w, decoration.h)
      .setDepth(1.5);
    return;
  }
  const edgeKey = decoration.kind === "industrial-edge-pipes"
    ? "industrialEdgePipes"
    : decoration.kind === "industrial-edge-tank"
      ? "industrialEdgeTank"
      : decoration.kind === "industrial-edge-turbine"
        ? "industrialEdgeTurbine"
        : null;
  if (edgeKey) {
    scene.add.image(x, y, edgeKey)
      .setDisplaySize(decoration.w, decoration.h)
      .setDepth(.5);
    return;
  }

  if (decoration.kind !== "industrial-energy-red" && decoration.kind !== "industrial-energy-blue") return;
  const red = decoration.kind === "industrial-energy-red";
  scene.add.image(x, y, red ? "industrialEnergyConduitRed" : "industrialEnergyConduitBlue")
    .setDisplaySize(decoration.w, decoration.h)
    .setFlipX(!red)
    .setDepth(-1.4);

  const padding = 42;
  const fromX = red ? decoration.x + padding : decoration.x + decoration.w - padding;
  const toX = red ? decoration.x + decoration.w - padding : decoration.x + padding;
  const pulse = scene.add.image(fromX, y, "industrialEnergyPulse")
    .setDisplaySize(74, 18)
    .setFlipX(red)
    .setTint(red ? 0xff4f4f : 0x4f8fff)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(.78)
    .setDepth(-1.2);
  scene.tweens.add({
    targets: pulse,
    x: toX,
    duration: 3200,
    ease: "Linear",
    repeat: -1,
    repeatDelay: 650,
  });
}

function drawRuinsBase(
  scene: Phaser.Scene,
  base: Rect,
  key: "ruinsBaseRed" | "ruinsBaseBlue",
  depth: number,
) {
  scene.add.image(base.x + base.w / 2, base.y + base.h / 2, key)
    .setDisplaySize(base.w + 8, base.h + 8)
    .setDepth(depth);
}

function ensureRuinsAnimations(scene: Phaser.Scene) {
  for (const team of ["Red", "Blue"] as const) {
    const key = `ruins-banner-cloth-${team.toLowerCase()}-flutter-v2`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(`ruinsBannerCloth${team}V2`, { start: 0, end: 3 }),
      frameRate: 2.4,
      repeat: -1,
      yoyo: true,
    });
  }
}

function drawRuinsDecoration(scene: Phaser.Scene, decoration: LevelDecoration) {
  const x = decoration.x + decoration.w / 2;
  const y = decoration.y + decoration.h / 2;

  if (decoration.kind === "ruins-column") {
    scene.add.image(x, y, "ruinsColumnBroken")
      .setDisplaySize(decoration.w, decoration.h)
      .setDepth(1);
    return;
  }
  if (decoration.kind === "ruins-overgrowth") {
    scene.add.image(x, y, "ruinsOvergrownRemains")
      .setDisplaySize(decoration.w, decoration.h)
      .setDepth(1);
    return;
  }
  if (decoration.kind === "ruins-banner-red" || decoration.kind === "ruins-banner-blue") {
    const red = decoration.kind === "ruins-banner-red";
    scene.add.image(x, y, "ruinsBannerStandV2")
      .setDisplaySize(decoration.w, decoration.h)
      .setDepth(2);
    scene.add.sprite(x, y, red ? "ruinsBannerClothRedV2" : "ruinsBannerClothBlueV2")
      .setDisplaySize(decoration.w, decoration.h)
      .setDepth(3)
      .play(`ruins-banner-cloth-${red ? "red" : "blue"}-flutter-v2`);
  }
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
