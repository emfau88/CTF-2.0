import type Phaser from "phaser";

const assetUrl = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

export function preloadArenaAssets(scene: Phaser.Scene) {
  scene.load.spritesheet("arenaTiles", assetUrl("arena-tileset.png"), {
    frameWidth: 313,
    frameHeight: 313,
  });
  scene.load.spritesheet("rocketProjectile", assetUrl("rocket-projectile.png?v=2"), {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.spritesheet("rocketSmoke", assetUrl("rocket-smoke.png?v=1"), {
    frameWidth: 180,
    frameHeight: 180,
  });
  scene.load.spritesheet("rocketExplosion", assetUrl("rocket-explosion.png?v=2"), {
    frameWidth: 256,
    frameHeight: 256,
  });
  scene.load.image("uiRocketButton", assetUrl("ui-rocket-button.png"));
  scene.load.image("uiAmmoBadge", assetUrl("ui-ammo-badge.png"));
  scene.load.image("pickupHealth", assetUrl("pickup-health.png"));
  scene.load.image("pickupArmor", assetUrl("pickup-armor.png"));
  scene.load.image("pickupRocket", assetUrl("pickup-rocket.png"));
  scene.load.image("pickupRail", assetUrl("pickup-rail.png"));
  scene.load.image("pickupWhip", assetUrl("pickup-whip.svg"));
  scene.load.image("uiRailButton", assetUrl("ui-rail-button.png"));
  scene.load.image("uiRailBadge", assetUrl("ui-rail-badge.png"));
  scene.load.image("uiWhipButton", assetUrl("ui-whip-button.svg"));
  scene.load.image("railImpact", assetUrl("rail-impact.png"));
  scene.load.image("flagRed", assetUrl("flag-red.png"));
  scene.load.image("flagBlue", assetUrl("flag-blue.png"));
  scene.load.image("spawnPad", assetUrl("spawn-pad.png"));
  scene.load.spritesheet("arenaCharacters", assetUrl("arena-characters.png"), {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.image("ruinsFloorStone", assetUrl("ruins/floor-stone.png"));
  scene.load.image("ruinsWallHorizontal", assetUrl("ruins/wall-horizontal.png"));
  scene.load.image("ruinsWallVertical", assetUrl("ruins/wall-vertical.png"));
  scene.load.image("ruinsGapChasm", assetUrl("ruins/gap-chasm.png"));
  scene.load.image("ruinsBaseRed", assetUrl("ruins/base-red.png"));
  scene.load.image("ruinsBaseBlue", assetUrl("ruins/base-blue.png"));
  scene.load.image("ruinsCombatCourt", assetUrl("ruins/combat-court.png"));
  scene.load.image("libraryFloorStone", assetUrl("library/floor-stone.png"));
  scene.load.image("libraryFloorWood", assetUrl("library/floor-wood.png"));
  scene.load.image("libraryFloorCarpet", assetUrl("library/floor-carpet.png"));
  scene.load.image("libraryShelfHorizontal", assetUrl("library/shelf-horizontal.png"));
  scene.load.image("libraryShelfVertical", assetUrl("library/shelf-vertical.png"));
  scene.load.image("libraryShelfDamaged", assetUrl("library/shelf-damaged.png"));
  scene.load.image("libraryRoundTable", assetUrl("library/round-table.png"));
  scene.load.image("libraryCollapsedFloor", assetUrl("library/collapsed-floor.png"));
  scene.load.image("libraryRug", assetUrl("library/rug.png"));
  scene.load.image("libraryBooks", assetUrl("library/book-pile.png"));
  scene.load.image("libraryCobweb", assetUrl("library/cobweb.png"));
  scene.load.image("librarySpider", assetUrl("library/spider.png"));
  scene.load.spritesheet("libraryCandleFlame", assetUrl("library/candle-flame.png"), {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.audio("step1", assetUrl("sounds/step1.wav"));
  scene.load.audio("step2", assetUrl("sounds/step2.wav"));
  scene.load.audio("step3", assetUrl("sounds/step3.wav"));
  scene.load.audio("step4", assetUrl("sounds/step4.wav"));
  scene.load.audio("step5", assetUrl("sounds/step5.wav"));
  scene.load.audio("getPowerup", assetUrl("sounds/get powerup.wav"));
  scene.load.audio("weaponUp", assetUrl("sounds/weapon up.wav"));
  scene.load.audio("playerUmf", assetUrl("sounds/player umf.wav"));
  scene.load.audio("railFire", assetUrl("sounds/doom_sniper_smg_crit.wav"));
  scene.load.audio("rocketFire", assetUrl("sounds/quake_rpg_fire.wav"));
  scene.load.audio("healthGlass", assetUrl("sounds/syringegun_reload_glass2.wav"));
  scene.load.audio("healthAir", assetUrl("sounds/syringegun_reload_air2.wav"));
  scene.load.audio("botBulletFire", assetUrl("sounds/pistol.wav"));
  scene.load.audio("botDeath", assetUrl("sounds/imp death 2.wav"));
  scene.load.audio("railHitConfirm", assetUrl("sounds/CrowdPlay_ControllerPress.wav"));
  scene.load.audio("whipSwing", assetUrl("sounds/slap_swing.wav"));
  scene.load.audio("whipHit", assetUrl("sounds/slap_hit4.wav"));
}
