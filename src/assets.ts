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
  scene.load.image("spawnPadLegacy", assetUrl("spawn-pad.png"));
  scene.load.image("spawnPadV2", assetUrl("spawn-pad-v2.png"));
  scene.load.spritesheet("spawnPadGlowV2", assetUrl("spawn-pad-glow-v2.png"), {
    frameWidth: 256,
    frameHeight: 256,
  });
  scene.load.spritesheet("arenaCharacters", assetUrl("arena-characters.png"), {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.spritesheet("alienRunner", assetUrl("alien-runner-spritesheet-4x4.png"), {
    frameWidth: 128,
    frameHeight: 128,
  });
  scene.load.spritesheet("riotDroidRunner", assetUrl("riot-droid-spritesheet-6x4.png"), {
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
  scene.load.image("ruinsColumnBroken", assetUrl("ruins/column-broken.png"));
  scene.load.image("ruinsOvergrownRemains", assetUrl("ruins/overgrown-remains.png"));
  scene.load.spritesheet("ruinsBannerRedLegacy", assetUrl("ruins/banner-red.png"), {
    frameWidth: 192,
    frameHeight: 256,
  });
  scene.load.spritesheet("ruinsBannerBlueLegacy", assetUrl("ruins/banner-blue.png"), {
    frameWidth: 192,
    frameHeight: 256,
  });
  scene.load.image("ruinsBannerStandV2", assetUrl("ruins/banner-stand-v2.png"));
  scene.load.spritesheet("ruinsBannerClothRedV2", assetUrl("ruins/banner-cloth-red-v2.png"), {
    frameWidth: 192,
    frameHeight: 256,
  });
  scene.load.spritesheet("ruinsBannerClothBlueV2", assetUrl("ruins/banner-cloth-blue-v2.png"), {
    frameWidth: 192,
    frameHeight: 256,
  });
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
  scene.load.image("industrialFloorMetal", assetUrl("industrial/floor-metal.png"));
  scene.load.image("industrialBaseRed", assetUrl("industrial/base-red.png"));
  scene.load.image("industrialBaseBlue", assetUrl("industrial/base-blue.png"));
  scene.load.image("industrialWallHorizontal", assetUrl("industrial/wall-horizontal.png"));
  scene.load.image("industrialWallVertical", assetUrl("industrial/wall-vertical.png"));
  scene.load.image("industrialMaintenancePit", assetUrl("industrial/maintenance-pit.png"));
  scene.load.image("industrialEnergyJunction", assetUrl("industrial/energy-junction.png"));
  scene.load.image("industrialEnergyConduitRed", assetUrl("industrial/energy-conduit-red.png"));
  scene.load.image("industrialEnergyConduitBlue", assetUrl("industrial/energy-conduit-blue.png"));
  scene.load.image("industrialEnergyPulse", assetUrl("industrial/energy-pulse.png"));
  scene.load.image("industrialSwitchGate", assetUrl("industrial/switch-gate.png"));
  scene.load.image("industrialEdgePipes", assetUrl("industrial/edge-pipe-manifold.png"));
  scene.load.image("industrialEdgeTank", assetUrl("industrial/edge-tank-valve.png"));
  scene.load.image("industrialEdgeTurbine", assetUrl("industrial/edge-turbine.png"));
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
