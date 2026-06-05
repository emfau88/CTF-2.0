import Phaser from "phaser";
import { T, TEAM } from "../config";
import {
  LEVEL_BY_ID,
  LEVEL_THEME_VISUALS,
  LEVELS,
  type LevelData,
  type LevelDecoration,
  type LevelGap,
  type LevelId,
  type LevelWall,
} from "../level";
import { len, lineIntersectsRect, type InputVector, type Rect, type Vec2 } from "../math";
import { Player } from "../player";
import { AutoAttack, Bot, CollisionSystem, FlagSystem, Pickup, PickupSystem, Projectile, type BotRole } from "../systems";

const assetUrl = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

type Trail = { x: number; y: number; life: number; max: number; air: boolean; speed: number };
type RocketSmokeFx = { x: number; y: number; life: number; max: number; frame: number; scale: number; rotation: number; view?: Phaser.GameObjects.Image };
type ExplosionFx = { x: number; y: number; life: number; max: number; view?: Phaser.GameObjects.Image };
type SpawnPadParticle = { x: number; y: number; ox: number; life: number; max: number; size: number };
type LibraryDust = { x: number; y: number; speed: number; drift: number; phase: number; size: number; alpha: number };
type RailBeamFx = { x1: number; y1: number; x2: number; y2: number; life: number; max: number; hit: boolean; impact?: Phaser.GameObjects.Image };
type LibraryCandle = {
  x: number;
  y: number;
  lit: boolean;
  flame: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Arc;
  flameTween: Phaser.Tweens.Tween;
  glowTween: Phaser.Tweens.Tween;
};

export class ArenaScene extends Phaser.Scene {
  player!: Player;
  level!: LevelData;
  levelId: LevelId = "training-crossing";
  redCount = 1;
  blueCount = 2;
  bots: Bot[] = [];
  projectiles: Projectile[] = [];
  collision!: CollisionSystem;
  flags!: FlagSystem;
  pickups!: PickupSystem;
  auto!: AutoAttack;
  botAutos = new Map<Bot, AutoAttack>();
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  jumpKey!: Phaser.Input.Keyboard.Key;
  joy = { active: false, id: -1, ox: 110, oy: 500, x: 0, y: 0, len: 0 };
  jumpBtn = { id: -1, x: 0, y: 0, r: 52, held: false, pressed: false };
  rocketBtn = { id: -1, x: 0, y: 0, r: 43, held: false, aimX: 1, aimY: 0, drag: 0, dragged: false };
  railBtn = { id: -1, x: 0, y: 0, r: 43, held: false, aimX: 1, aimY: 0, drag: 0, dragged: false };
  gfx!: Phaser.GameObjects.Graphics;
  trailGfx!: Phaser.GameObjects.Graphics;
  atmosphereGfx!: Phaser.GameObjects.Graphics;
  uiGfx!: Phaser.GameObjects.Graphics;
  playerBody!: Phaser.GameObjects.Arc;
  playerRing!: Phaser.GameObjects.Arc;
  shadow!: Phaser.GameObjects.Ellipse;
  botViews = new Map<Bot, Phaser.GameObjects.Arc>();
  projectileViews = new Map<Projectile, Phaser.GameObjects.Arc>();
  rocketViews = new Map<Projectile, Phaser.GameObjects.Image>();
  pickupViews = new Map<Pickup, Phaser.GameObjects.Container>();
  flagViews = new Map<string, Phaser.GameObjects.Image>();
  rocketButtonView?: Phaser.GameObjects.Image;
  ammoBadgeView?: Phaser.GameObjects.Image;
  ammoText?: Phaser.GameObjects.Text;
  railButtonView?: Phaser.GameObjects.Image;
  railAmmoBadgeView?: Phaser.GameObjects.Image;
  railAmmoText?: Phaser.GameObjects.Text;
  botAlive = new Map<Bot, boolean>();
  trail: Trail[] = [];
  rocketSmoke: RocketSmokeFx[] = [];
  rocketSmokeTimers = new Map<Projectile, number>();
  explosions: ExplosionFx[] = [];
  railBeams: RailBeamFx[] = [];
  spawnPadParticles: SpawnPadParticle[] = [];
  libraryDust: LibraryDust[] = [];
  libraryCandles: LibraryCandle[] = [];
  spawnPadParticleTimer = 0;
  trailTimer = 0;
  lastState = "alive";
  debugVisible = window.innerWidth > 620;

  preload() {
    this.load.spritesheet("arenaTiles", assetUrl("arena-tileset.png"), {
      frameWidth: 313,
      frameHeight: 313,
    });
    this.load.spritesheet("rocketProjectile", assetUrl("rocket-projectile.png?v=2"), {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("rocketSmoke", assetUrl("rocket-smoke.png?v=1"), {
      frameWidth: 180,
      frameHeight: 180,
    });
    this.load.spritesheet("rocketExplosion", assetUrl("rocket-explosion.png?v=2"), {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.image("uiRocketButton", assetUrl("ui-rocket-button.png"));
    this.load.image("uiAmmoBadge", assetUrl("ui-ammo-badge.png"));
    this.load.image("pickupHealth", assetUrl("pickup-health.png"));
    this.load.image("pickupArmor", assetUrl("pickup-armor.png"));
    this.load.image("pickupRocket", assetUrl("pickup-rocket.png"));
    this.load.image("pickupRail", assetUrl("pickup-rail.png"));
    this.load.image("uiRailButton", assetUrl("ui-rail-button.png"));
    this.load.image("uiRailBadge", assetUrl("ui-rail-badge.png"));
    this.load.image("railImpact", assetUrl("rail-impact.png"));
    this.load.image("flagRed", assetUrl("flag-red.png"));
    this.load.image("flagBlue", assetUrl("flag-blue.png"));
    this.load.image("spawnPad", assetUrl("spawn-pad.png"));
    this.load.image("libraryFloorStone", assetUrl("library/floor-stone.png"));
    this.load.image("libraryFloorWood", assetUrl("library/floor-wood.png"));
    this.load.image("libraryFloorCarpet", assetUrl("library/floor-carpet.png"));
    this.load.image("libraryShelfHorizontal", assetUrl("library/shelf-horizontal.png"));
    this.load.image("libraryShelfVertical", assetUrl("library/shelf-vertical.png"));
    this.load.image("libraryShelfDamaged", assetUrl("library/shelf-damaged.png"));
    this.load.image("libraryRoundTable", assetUrl("library/round-table.png"));
    this.load.image("libraryCollapsedFloor", assetUrl("library/collapsed-floor.png"));
    this.load.image("libraryRug", assetUrl("library/rug.png"));
    this.load.image("libraryBooks", assetUrl("library/book-pile.png"));
    this.load.image("libraryCobweb", assetUrl("library/cobweb.png"));
    this.load.image("librarySpider", assetUrl("library/spider.png"));
    this.load.spritesheet("libraryCandleFlame", assetUrl("library/candle-flame.png"), {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create(data?: { mapId?: LevelId; redCount?: number; blueCount?: number }) {
    this.resetViewState();
    this.levelId = data?.mapId && LEVEL_BY_ID[data.mapId] ? data.mapId : "training-crossing";
    this.redCount = this.teamCount(data?.redCount, 1);
    this.blueCount = this.teamCount(data?.blueCount, 2);
    this.level = LEVEL_BY_ID[this.levelId];
    this.player = new Player(this.level.redSpawn.x, this.level.redSpawn.y, "red");
    this.bots = [
      ...this.createTeamBots("red", Math.max(0, this.redCount - 1)),
      ...this.createTeamBots("blue", this.blueCount),
    ];
    this.collision = new CollisionSystem(this.level);
    this.flags = new FlagSystem(this.level);
    this.pickups = new PickupSystem(this.level.pickups);
    this.auto = new AutoAttack(this.player, this.projectiles);
    this.botAutos = new Map(this.bots.map((bot) => [bot, new AutoAttack(bot, this.projectiles, T.botFireRate)]));
    this.botAlive = new Map(this.bots.map((bot) => [bot, bot.alive]));

    if (!this.anims.exists("library-candle-flicker")) {
      this.anims.create({
        key: "library-candle-flicker",
        frames: this.anims.generateFrameNumbers("libraryCandleFlame", { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
        yoyo: true,
      });
    }
    this.drawArena();
    this.atmosphereGfx = this.add.graphics().setDepth(8);
    if (this.level.theme === "library") this.createLibraryAtmosphere();
    this.trailGfx = this.add.graphics().setDepth(15);
    this.gfx = this.add.graphics().setDepth(40);
    this.uiGfx = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.shadow = this.add.ellipse(this.player.x, this.player.y + 8, 34, 14, 0x000000, .2).setDepth(20);
    this.playerBody = this.add.circle(this.player.x, this.player.y, this.player.radius, TEAM.red.color).setDepth(35);
    this.playerRing = this.add.circle(this.player.x, this.player.y, this.player.radius + 4).setStrokeStyle(3, 0xffffff).setDepth(36);
    for (const b of this.bots) this.botViews.set(b, this.add.circle(b.x, b.y, b.radius, TEAM[b.team].color).setStrokeStyle(3, 0xffffff).setDepth(32));

    if (!this.input.keyboard) throw new Error("keyboard unavailable");
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: "W", down: "S", left: "A", right: "D" }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT", "W", "A", "S", "D"]);
    this.input.addPointer(2);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.pointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.pointerMove(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.pointerUp(p));
    this.scale.on("resize", () => this.layoutTouch());
    this.layoutTouch();
    this.setupHudButtons();

    this.cameras.main.setBounds(0, 0, T.worldWidth, T.worldHeight);
    this.cameras.main.startFollow(this.playerBody, true, .12, .12);
  }

  resetViewState() {
    this.botViews = new Map();
    this.projectileViews = new Map();
    this.rocketViews = new Map();
    this.pickupViews = new Map();
    this.flagViews = new Map();
    this.rocketButtonView = undefined;
    this.ammoBadgeView = undefined;
    this.ammoText = undefined;
    this.railButtonView = undefined;
    this.railAmmoBadgeView = undefined;
    this.railAmmoText = undefined;
    this.trail = [];
    this.rocketSmoke = [];
    this.rocketSmokeTimers = new Map();
    this.explosions = [];
    this.railBeams = [];
    this.spawnPadParticles = [];
    this.libraryDust = [];
    this.libraryCandles = [];
    this.spawnPadParticleTimer = 0;
    this.trailTimer = 0;
    this.lastState = "alive";
  }

  update(_t: number, delta: number) {
    const ms = Math.min(delta, 34), dt = ms / 1000;
    this.player.railCooldown = Math.max(0, this.player.railCooldown - ms);
    const input = this.inputVector();
    if (input.length > .05) this.player.lastMoveDir = { x: input.x, y: input.y };
    if (Phaser.Input.Keyboard.JustDown(this.jumpKey) || this.jumpBtn.pressed) this.player.jump.start();
    this.jumpBtn.pressed = false;
    if (!this.jumpKey.isDown && !this.jumpBtn.held) this.player.jump.release();

    this.player.prevX = this.player.x; this.player.prevY = this.player.y;
    if (this.player.state === "alive") {
      this.player.jump.update(ms);
      this.player.movement.update(dt, input);
      this.player.x += this.player.vx * dt * T.jumpDistanceInfluence;
      this.player.y += this.player.vy * dt * T.jumpDistanceInfluence;
      this.collision.update(this.player, ms);
    } else {
      this.player.stateTimer -= ms;
      if (this.player.stateTimer <= 0) this.player.respawn(this.player.state === "falling" ? this.player.lastSafe : this.level.redSpawn);
    }
    if (this.lastState === "alive" && this.player.state !== "alive") {
      this.flags.failed(this.player);
      if (this.player.state === "dead") this.dropWeaponAmmo(this.player);
    }
    this.lastState = this.player.state;

    const blockers: Rect[] = [...this.level.walls, ...this.level.gaps];
    const actors = [this.player, ...this.bots];
    for (const b of this.bots) b.update(dt, ms, blockers, this.flags, actors, this.level.walls, this.pickups.pickups);
    for (const p of this.projectiles) {
      const wasDead = p.dead;
      p.update(dt, ms, [...this.bots, this.player], this.level.walls);
      if (!wasDead && p.dead) this.handleLibraryProjectileImpact(p);
    }
    this.emitRocketSmoke(ms);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].dead) {
        if (this.projectiles[i].exploded) this.explosions.push({ x: this.projectiles[i].x, y: this.projectiles[i].y, life: 420, max: 420 });
        this.rocketSmokeTimers.delete(this.projectiles[i]);
        this.projectiles.splice(i, 1);
      }
    }
    this.auto.update(ms, this.bots, this.level.walls);
    for (const b of this.bots) this.botAutos.get(b)?.update(ms, actors, this.level.walls);
    for (const b of this.bots) {
      const wasAlive = this.botAlive.get(b) ?? b.alive;
      if (wasAlive && !b.alive) {
        this.flags.failed(b);
        this.dropWeaponAmmo(b);
      }
      this.botAlive.set(b, b.alive);
    }
    this.flags.update(this.player);
    this.pickups.update(ms, actors);
    this.updateTrail(ms);
    this.updateRocketSmoke(ms);
    this.updateExplosions(ms);
    this.updateRailBeams(ms);
    this.updateSpawnPadParticles(ms);
    this.updateLibraryDust(dt);
    this.render();
  }

  inputVector(): InputVector {
    let x = this.joy.x, y = this.joy.y, l = this.joy.len;
    if (this.cursors.left.isDown || this.wasd.left.isDown) x = -1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) x = 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) y = -1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) y = 1;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    if (d > 0 && l === 0) l = 1;
    return { x, y, length: Math.min(1, Math.max(l, d > 0 ? 1 : 0)) };
  }

  teamCount(value: number | undefined, fallback: number) {
    return Phaser.Math.Clamp(Math.round(value ?? fallback), 1, 4);
  }

  createTeamBots(team: "red" | "blue", count: number) {
    const spawn = team === "red" ? this.level.redSpawn : this.level.blueSpawn;
    const side = team === "red" ? 1 : -1;
    const offsets = [
      { x: 80 * side, y: -110 },
      { x: 80 * side, y: 110 },
      { x: 145 * side, y: 0 },
      { x: 55 * side, y: 0 },
    ];
    const roles: BotRole[] = ["attacker", "defender", "support", "attacker"];
    return Array.from({ length: count }, (_, index) => {
      const offset = offsets[index] ?? offsets[0];
      const role = roles[index] ?? "attacker";
      return new Bot(spawn.x + offset.x, spawn.y + offset.y, team, role, this.level);
    });
  }

  restartWithSettings(mapId: LevelId = this.levelId) {
    this.scene.restart({ mapId, redCount: this.redCount, blueCount: this.blueCount });
  }

  render() {
    this.renderLibraryDust();
    this.renderTrail();
    this.gfx.clear();
    this.renderExplosions();
    this.renderRailBeams();
    this.renderFlags();
    this.renderPickups();
    this.renderRocketSmoke();
    this.renderPlayer();
    for (const b of this.bots) {
      this.botViews.get(b)
        ?.setPosition(b.x, b.y)
        .setFillStyle(TEAM[b.team].color)
        .setVisible(b.alive);
      if (b.alive) this.drawHpBar(b.x - 18, b.y - 31, 36, 5, b.hp / T.botMaxHp, TEAM[b.team].dark);
    }
    for (const p of this.projectiles) {
      if (p.kind === "rocket") {
        if (!this.rocketViews.has(p)) {
          this.rocketViews.set(p, this.add.image(p.x, p.y, "rocketProjectile", 2).setDepth(52).setScale(.46));
        }
        this.rocketViews.get(p)
          ?.setPosition(p.x, p.y)
          .setRotation(Math.atan2(p.vy, p.vx));
      } else {
        const color = p.owner.team === "red" ? TEAM.red.dark : TEAM.blue.dark;
        if (!this.projectileViews.has(p)) {
          this.projectileViews.set(p, this.add.circle(p.x, p.y, p.radius, color, .95).setStrokeStyle(2, 0xffffff, .85).setDepth(50));
        }
        this.projectileViews.get(p)?.setPosition(p.x, p.y).setRadius(p.radius).setFillStyle(color, .95);
      }
    }
    for (const [p, v] of this.projectileViews) if (p.dead) { v.destroy(); this.projectileViews.delete(p); }
    for (const [p, v] of this.rocketViews) if (p.dead) { v.destroy(); this.rocketViews.delete(p); }
    this.renderRocketAim();
    this.renderRailAim();
    this.drawTouch();
    this.updateHud();
  }

  renderPlayer() {
    const h = this.player.jump.height, s = Math.min(1, this.player.speed() / T.maxSpeed), scale = 1 + h / 210;
    this.shadow.setPosition(this.player.x, this.player.y + 8).setScale(1 + h / 160, Math.max(.35, 1 - h / 95)).setAlpha(this.player.state === "alive" ? Math.max(.1, .22 - h / 330) : 0);
    const team = TEAM[this.player.team];
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(team.color),
      Phaser.Display.Color.IntegerToColor(team.dark),
      100,
      Math.round(s * 100),
    ).color;
    this.playerBody.setPosition(this.player.x, this.player.y - h).setRadius(this.player.radius * scale).setFillStyle(this.player.state === "falling" ? 0x333333 : color, this.player.state === "alive" ? 1 : .35).setVisible(this.player.state !== "dead");
    this.playerRing.setPosition(this.player.x, this.player.y - h).setRadius(this.player.radius * scale + 4).setStrokeStyle(3, this.player.jump.active ? 0xffd86b : 0xffffff, .95).setVisible(this.player.state !== "dead");
    if (this.player.state === "alive") {
      this.drawHpBar(this.player.x - 22, this.player.y - h - 38, 44, 6, this.player.hp / T.playerMaxHp, TEAM.red.dark);
      if (this.player.armor > 0) {
        this.gfx.lineStyle(4, 0x29c46a, .95).beginPath().arc(this.player.x, this.player.y - h, this.player.radius * scale + 9, -2.55, -.6).strokePath();
      }
    }
  }

  renderPickups() {
    for (const pickup of this.pickups.pickups) {
      if (!this.pickupViews.has(pickup)) this.pickupViews.set(pickup, this.createPickupView(pickup));
      const view = this.pickupViews.get(pickup);
      view?.setVisible(true);
      const age = this.time.now * .001 + pickup.x * .011 + pickup.y * .007;
      const pad = view?.getByName("pad") as Phaser.GameObjects.Image | undefined;
      const icon = view?.getByName("icon") as Phaser.GameObjects.Image | undefined;
      const label = view?.getByName("amount") as Phaser.GameObjects.Text | undefined;
      pad?.setRotation(0).setScale(.27).setAlpha((pickup.temporary ? .38 : .82) + Math.sin(age * 2.4) * .05);
      icon?.setVisible(pickup.active).setScale((pickup.temporary ? .17 : .18) + Math.sin(age * 3.2) * .008).setAlpha(pickup.active ? 1 : .2);
      label?.setVisible(pickup.active && pickup.temporary);
    }
    for (const [pickup, view] of this.pickupViews) {
      if (!this.pickups.pickups.includes(pickup)) {
        view.destroy(true);
        this.pickupViews.delete(pickup);
      }
    }
    this.renderSpawnPadParticles();
  }

  dropWeaponAmmo(actor: Player | Bot) {
    if (actor.rocketAmmo > 0) {
      this.pickups.dropRocketAmmo(actor.x - 15, actor.y, actor.rocketAmmo);
      actor.rocketAmmo = 0;
    }
    if (actor.railAmmo > 0) {
      this.pickups.dropRailAmmo(actor.x + 15, actor.y, actor.railAmmo);
      actor.railAmmo = 0;
    }
  }

  createPickupView(pickup: Pickup) {
    const container = this.add.container(pickup.x, pickup.y).setDepth(18);
    const iconKey = pickup.kind === "health" ? "pickupHealth"
      : pickup.kind === "armor" ? "pickupArmor"
        : pickup.kind === "rocket" ? "pickupRocket" : "pickupRail";
    const weapon = pickup.kind === "rocket" || pickup.kind === "rail";
    const icon = this.add.image(0, weapon ? -3 : -5, iconKey).setName("icon").setScale(pickup.temporary ? .17 : .18).setDepth(1);
    if (!pickup.temporary) {
      container.add(this.add.image(0, 2, "spawnPad").setName("pad").setScale(.27).setAlpha(.82).setDepth(0));
    }
    container.add(icon);
    if (pickup.temporary) {
      container.add(this.add.text(16, 12, String(pickup.amount), {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#ffffff",
        stroke: "#17211f",
        strokeThickness: 4,
      }).setName("amount").setOrigin(.5).setDepth(2));
    }
    return container;
  }

  renderFlags() {
    for (const f of Object.values(this.flags.flags)) {
      const key = f.team;
      if (!this.flagViews.has(key)) {
        this.flagViews.set(key, this.add.image(f.x, f.y - 16, f.team === "red" ? "flagRed" : "flagBlue").setDepth(34).setScale(.28));
      }
      this.flagViews.get(key)
        ?.setPosition(f.x + 10, f.y - 18)
        .setScale(.25 + Math.sin(this.time.now * .006) * .01)
        .setAlpha(f.carrier ? .94 : 1);
    }
  }

  drawHpBar(x: number, y: number, w: number, h: number, ratio: number, color: number) {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    this.gfx.fillStyle(0x17211f, .72).fillRoundedRect(x, y, w, h, 2);
    this.gfx.fillStyle(color, .95).fillRoundedRect(x, y, w * clamped, h, 2);
  }

  updateTrail(ms: number) {
    this.trailTimer -= ms;
    const s = Math.min(1, this.player.speed() / T.maxSpeed);
    if (this.player.state === "alive" && this.trailTimer <= 0 && this.player.speed() > 48) {
      this.trailTimer = Math.max(7, T.trailIntervalMs - s * 8);
      this.trail.push({ x: this.player.x, y: this.player.y, life: T.trailLifeMs, max: T.trailLifeMs, air: this.player.jump.active, speed: s });
      if (this.trail.length > T.trailMax) this.trail.shift();
    }
    this.trail.forEach(t => t.life -= ms);
    this.trail = this.trail.filter(t => t.life > 0);
  }

  renderTrail() {
    this.trailGfx.clear();
    for (const t of this.trail) {
      const a = t.life / t.max;
      this.trailGfx.fillStyle(t.air ? 0x5eb5dc : 0x234f49, a * (t.air ? .34 : .22)).fillCircle(t.x, t.y, (5 + t.speed * 9) * a);
    }
  }

  emitRocketSmoke(ms: number) {
    for (const p of this.projectiles) {
      if (p.kind !== "rocket" || p.dead) continue;
      const next = (this.rocketSmokeTimers.get(p) ?? 0) - ms;
      if (next > 0) {
        this.rocketSmokeTimers.set(p, next);
        continue;
      }
      const speed = len(p.vx, p.vy) || 1;
      const nx = p.vx / speed, ny = p.vy / speed;
      this.rocketSmoke.push({
        x: p.x - nx * 20 + Phaser.Math.Between(-4, 4),
        y: p.y - ny * 20 + Phaser.Math.Between(-4, 4),
        life: 320,
        max: 320,
        frame: Phaser.Math.Between(0, 5),
        scale: Phaser.Math.FloatBetween(.16, .24),
        rotation: Phaser.Math.FloatBetween(-.45, .45),
      });
      this.rocketSmokeTimers.set(p, 42);
    }
  }

  updateRocketSmoke(ms: number) {
    for (const fx of this.rocketSmoke) fx.life -= ms;
    for (const fx of this.rocketSmoke.filter((fx) => fx.life <= 0)) fx.view?.destroy();
    this.rocketSmoke = this.rocketSmoke.filter((fx) => fx.life > 0);
  }

  renderRocketSmoke() {
    for (const fx of this.rocketSmoke) {
      const t = 1 - fx.life / fx.max;
      const alpha = Math.max(0, fx.life / fx.max) * .72;
      if (!fx.view) {
        fx.view = this.add.image(fx.x, fx.y, "rocketSmoke", fx.frame).setDepth(49).setBlendMode(Phaser.BlendModes.NORMAL);
      }
      fx.view
        .setPosition(fx.x, fx.y)
        .setRotation(fx.rotation)
        .setScale(fx.scale * (1 + t * .75))
        .setAlpha(alpha);
    }
  }

  updateExplosions(ms: number) {
    this.explosions.forEach((fx) => fx.life -= ms);
    for (const fx of this.explosions.filter((fx) => fx.life <= 0)) fx.view?.destroy();
    this.explosions = this.explosions.filter((fx) => fx.life > 0);
  }

  updateSpawnPadParticles(ms: number) {
    this.spawnPadParticleTimer -= ms;
    if (this.spawnPadParticleTimer <= 0) {
      this.spawnPadParticleTimer = 95;
      for (const pickup of this.pickups.pickups) {
        if (pickup.temporary) continue;
        const life = Phaser.Math.Between(620, 920);
        this.spawnPadParticles.push({
          x: pickup.x + Phaser.Math.Between(-14, 14),
          y: pickup.y - 2 + Phaser.Math.Between(-4, 7),
          ox: Phaser.Math.FloatBetween(-8, 8),
          life,
          max: life,
          size: Phaser.Math.FloatBetween(2.2, 4.2),
        });
      }
    }
    for (const particle of this.spawnPadParticles) particle.life -= ms;
    this.spawnPadParticles = this.spawnPadParticles.filter((particle) => particle.life > 0);
  }

  renderSpawnPadParticles() {
    for (const particle of this.spawnPadParticles) {
      const t = 1 - particle.life / particle.max;
      const alpha = Phaser.Math.Clamp(particle.life / particle.max, 0, 1) * .45;
      this.gfx.fillStyle(0x7dfcff, alpha).fillCircle(
        particle.x + particle.ox * t,
        particle.y - t * 34,
        particle.size * (1 - t * .35),
      );
    }
  }

  renderExplosions() {
    for (const fx of this.explosions) {
      const t = 1 - fx.life / fx.max;
      const alpha = fx.life / fx.max;
      const frame = Phaser.Math.Clamp(Math.floor(t * 6), 0, 5);
      if (!fx.view) {
        fx.view = this.add.image(fx.x, fx.y, "rocketExplosion", 0).setDepth(70).setScale(.38);
      }
      fx.view
        .setFrame(frame)
        .setPosition(fx.x, fx.y)
        .setScale(.30 + t * .16)
        .setAlpha(Math.min(1, alpha * 1.25));
      this.gfx.fillStyle(0xf59f2f, .08 * alpha).fillCircle(fx.x, fx.y, T.rocketSplashRadius * Math.min(1, t * 1.25));
      this.gfx.lineStyle(2, 0xffd36c, .3 * alpha).strokeCircle(fx.x, fx.y, T.rocketSplashRadius * Math.min(1, t * 1.1));
    }
  }
  updateRailBeams(ms: number) {
    for (const beam of this.railBeams) beam.life -= ms;
    for (const beam of this.railBeams.filter((beam) => beam.life <= 0)) beam.impact?.destroy();
    this.railBeams = this.railBeams.filter((beam) => beam.life > 0);
  }
  renderRailBeams() {
    for (const beam of this.railBeams) {
      const alpha = Phaser.Math.Clamp(beam.life / beam.max, 0, 1);
      this.gfx.lineStyle(14, 0x34ff79, .08 * alpha).beginPath().moveTo(beam.x1, beam.y1).lineTo(beam.x2, beam.y2).strokePath();
      this.gfx.lineStyle(7, 0x20e966, .32 * alpha).beginPath().moveTo(beam.x1, beam.y1).lineTo(beam.x2, beam.y2).strokePath();
      this.gfx.lineStyle(3, 0xbaffd0, .96 * alpha).beginPath().moveTo(beam.x1, beam.y1).lineTo(beam.x2, beam.y2).strokePath();
      this.gfx.fillStyle(0xe6ffed, .9 * alpha).fillCircle(beam.x1, beam.y1, 4);
      if (beam.hit) {
        if (!beam.impact) beam.impact = this.add.image(beam.x2, beam.y2, "railImpact").setDepth(56).setScale(.18);
        beam.impact.setPosition(beam.x2, beam.y2).setRotation(this.time.now * .018).setScale(.13 + (1 - alpha) * .1).setAlpha(alpha);
      }
    }
  }
  fireRailgun(owner: Player | Bot, direction: Vec2, targets: Array<Player | Bot>) {
    if (owner.railAmmo <= 0 || owner.railCooldown > 0) return false;
    if (owner instanceof Player && owner.state !== "alive") return false;
    if (owner instanceof Bot && !owner.alive) return false;
    const magnitude = len(direction.x, direction.y);
    if (magnitude < .001) return false;
    const dx = direction.x / magnitude, dy = direction.y / magnitude;
    const start = {
      x: owner.x + dx * (owner.radius + 5),
      y: owner.y - (owner instanceof Player ? owner.jump.height : 0) + dy * (owner.radius + 5),
    };
    let distance = T.railRange;
    for (const wall of this.level.walls) distance = Math.min(distance, this.rayRectDistance(start, { x: dx, y: dy }, wall) ?? distance);
    let hit: Player | Bot | null = null;
    for (const target of targets) {
      if (target === owner || target.team === owner.team) continue;
      if (target instanceof Bot && !target.alive) continue;
      if (target instanceof Player && target.state !== "alive") continue;
      const targetDistance = this.rayCircleDistance(start, { x: dx, y: dy }, target, target.radius + 5);
      if (targetDistance === null || targetDistance >= distance) continue;
      distance = targetDistance;
      hit = target;
    }
    const end = { x: start.x + dx * distance, y: start.y + dy * distance };
    if (hit) {
      const maxHp = hit instanceof Player ? T.playerMaxHp : T.botMaxHp;
      hit.damage(maxHp * T.railDamageRatio);
    }
    if (this.level.theme === "library") {
      for (const candle of this.libraryCandles.filter((item) => item.lit)) {
        const distanceToBeam = this.pointSegmentDistance(candle, start, end);
        if (distanceToBeam <= 12) this.extinguishLibraryCandle(candle);
      }
    }
    owner.railAmmo--;
    owner.railCooldown = T.railCooldownMs;
    this.railBeams.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, life: T.railBeamLifeMs, max: T.railBeamLifeMs, hit: Boolean(hit) });
    return true;
  }
  rayCircleDistance(origin: Vec2, direction: Vec2, center: Vec2, radius: number) {
    const ox = origin.x - center.x, oy = origin.y - center.y;
    const projection = ox * direction.x + oy * direction.y;
    const discriminant = projection * projection - (ox * ox + oy * oy - radius * radius);
    if (discriminant < 0) return null;
    const near = -projection - Math.sqrt(discriminant);
    const far = -projection + Math.sqrt(discriminant);
    return near >= 0 ? near : far >= 0 ? far : null;
  }
  rayRectDistance(origin: Vec2, direction: Vec2, rect: Rect) {
    let near = 0, far = Infinity;
    for (const axis of ["x", "y"] as const) {
      const min = rect[axis];
      const max = min + (axis === "x" ? rect.w : rect.h);
      const value = origin[axis], delta = direction[axis];
      if (Math.abs(delta) < .00001) {
        if (value < min || value > max) return null;
        continue;
      }
      const a = (min - value) / delta, b = (max - value) / delta;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
    return far >= 0 ? Math.max(0, near) : null;
  }
  pointSegmentDistance(point: Vec2, start: Vec2, end: Vec2) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return len(point.x - start.x, point.y - start.y);
    const t = Phaser.Math.Clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
    return len(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
  }

  renderRocketAim() {
    if (!this.rocketBtn.held || !this.rocketBtn.dragged || this.player.rocketAmmo <= 0 || this.player.state !== "alive") return;
    const alpha = this.rocketBtn.drag < 18 ? .22 : .78;
    const h = this.player.jump.height;
    const sx = this.player.x, sy = this.player.y - h;
    const ex = sx + this.rocketBtn.aimX * 260, ey = sy + this.rocketBtn.aimY * 260;
    this.gfx.lineStyle(4, 0xffd36c, alpha).beginPath().moveTo(sx, sy).lineTo(ex, ey).strokePath();
    this.gfx.fillStyle(0xfff0b2, alpha).fillCircle(ex, ey, 7);
  }
  renderRailAim() {
    if (!this.railBtn.held || !this.railBtn.dragged || this.player.railAmmo <= 0 || this.player.state !== "alive") return;
    const ready = this.player.railCooldown <= 0;
    const h = this.player.jump.height;
    const sx = this.player.x, sy = this.player.y - h;
    const ex = sx + this.railBtn.aimX * 310, ey = sy + this.railBtn.aimY * 310;
    this.gfx.lineStyle(ready ? 3 : 2, ready ? 0x62ff91 : 0x6b8072, ready ? .8 : .3)
      .beginPath().moveTo(sx, sy).lineTo(ex, ey).strokePath();
    this.gfx.fillStyle(ready ? 0xcaffd9 : 0x7b8c80, ready ? .86 : .35).fillCircle(ex, ey, 6);
  }

  drawArena() {
    const g = this.add.graphics().setDepth(0);
    const visuals = LEVEL_THEME_VISUALS[this.level.theme];
    this.drawFloorTiles();
    if (this.level.theme === "library" && this.level.combatZone) {
      const r = this.level.combatZone;
      this.add.image(r.x + r.w / 2, r.y + r.h / 2, "libraryFloorCarpet")
        .setDisplaySize(r.w, r.h)
        .setAlpha(.78)
        .setDepth(-1.8);
    }
    this.drawObjectSprite(this.level.redBase, visuals.redBase, .92);
    this.drawObjectSprite(this.level.blueBase, visuals.blueBase, .92);
    if (this.level.theme === "library") {
      for (const decoration of this.level.decorations ?? []) this.drawLibraryDecoration(g, decoration);
      for (const gap of this.level.gaps) this.drawLibraryGap(g, gap);
      for (const wall of this.level.walls) this.drawLibraryWall(g, wall);
    } else {
      for (const gap of this.level.gaps) this.drawObjectSprite(gap, visuals.gap, 1);
      for (const wall of this.level.walls) this.drawObjectSprite(wall, wall.w > wall.h ? visuals.wallHorizontal : visuals.wallVertical, 1);
    }

    g.lineStyle(1, 0xcadbd4, .28);
    for (let x = 0; x <= T.worldWidth; x += 50) g.beginPath().moveTo(x, 0).lineTo(x, T.worldHeight).strokePath();
    for (let y = 0; y <= T.worldHeight; y += 50) g.beginPath().moveTo(0, y).lineTo(T.worldWidth, y).strokePath();
    this.zone(g, this.level.redBase, TEAM.red.base, TEAM.red.dark); this.zone(g, this.level.blueBase, TEAM.blue.base, TEAM.blue.dark);
    if (this.level.combatZone) this.combatZone(g, this.level.combatZone);
    g.lineStyle(3, 0x9dafaa, .45).beginPath().moveTo(T.worldWidth / 2, 40).lineTo(T.worldWidth / 2, T.worldHeight - 40).strokePath();
  }
  drawFloorTiles() {
    const size = 50;
    const visuals = LEVEL_THEME_VISUALS[this.level.theme];
    for (let y = 0; y < T.worldHeight; y += size) {
      for (let x = 0; x < T.worldWidth; x += size) {
        if (this.level.theme === "library") {
          const gallery = y < 165 || y >= T.worldHeight - 165;
          const key = gallery ? "libraryFloorWood" : "libraryFloorStone";
          this.add.image(x + size / 2, y + size / 2, key).setDisplaySize(size, size).setDepth(-2);
          continue;
        }
        const frame = (Math.floor(x / size) + Math.floor(y / size) * 2) % 7 === 0 ? visuals.floorAccent : visuals.floorPrimary;
        this.add.image(x + size / 2, y + size / 2, "arenaTiles", frame).setDisplaySize(size, size).setDepth(-2);
      }
    }
  }
  drawObjectSprite(r: Rect, frame: number, alpha = 1) {
    this.add.image(r.x + r.w / 2, r.y + r.h / 2, "arenaTiles", frame).setDisplaySize(r.w, r.h).setAlpha(alpha).setDepth(-1);
  }
  zone(g: Phaser.GameObjects.Graphics, r: Rect, fill: number, stroke: number) { g.fillStyle(fill, .18).fillRoundedRect(r.x, r.y, r.w, r.h, 8).lineStyle(3, stroke, .62).strokeRoundedRect(r.x, r.y, r.w, r.h, 8); }
  combatZone(g: Phaser.GameObjects.Graphics, r: Rect) {
    const library = this.level.theme === "library";
    g.fillStyle(library ? 0x7a2736 : 0xdff6ef, library ? .08 : .13).fillRoundedRect(r.x, r.y, r.w, r.h, 24);
    g.lineStyle(2, library ? 0xb58b58 : 0x4d887d, library ? .3 : .34).strokeRoundedRect(r.x, r.y, r.w, r.h, 24);
    g.lineStyle(1, 0xffffff, .3).strokeCircle(r.x + r.w / 2, r.y + r.h / 2, 76);
  }
  drawLibraryWall(g: Phaser.GameObjects.Graphics, wall: LevelWall) {
    const table = wall.visual === "reading-table";
    g.fillStyle(0x17120f, .18).fillRoundedRect(wall.x + 5, wall.y + 7, wall.w, wall.h, 7);
    if (table) {
      this.add.image(wall.x + wall.w / 2, wall.y + wall.h / 2, "libraryRoundTable")
        .setDisplaySize(wall.w + 10, wall.h + 10)
        .setDepth(2);
      this.addLibraryCandles(wall.x + wall.w / 2, wall.y + wall.h / 2);
      return;
    }
    const horizontal = wall.w > wall.h;
    const key = wall.visual === "bookshelf-damaged"
      ? "libraryShelfDamaged"
      : horizontal ? "libraryShelfHorizontal" : "libraryShelfVertical";
    this.add.image(wall.x + wall.w / 2, wall.y + wall.h / 2, key)
      .setDisplaySize(wall.w + (horizontal ? 8 : 4), wall.h + (horizontal ? 4 : 8))
      .setDepth(2);
  }
  drawLibraryGap(g: Phaser.GameObjects.Graphics, gap: LevelGap) {
    g.fillStyle(0x090707, .66).fillRoundedRect(gap.x + 3, gap.y + 5, gap.w, gap.h, 8);
    this.add.image(gap.x + gap.w / 2, gap.y + gap.h / 2, "libraryCollapsedFloor")
      .setDisplaySize(gap.w + 12, gap.h + 12)
      .setDepth(1);
  }
  drawLibraryDecoration(g: Phaser.GameObjects.Graphics, decoration: LevelDecoration) {
    if (decoration.kind === "rug") {
      this.add.image(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, "libraryRug")
        .setDisplaySize(decoration.w, decoration.h)
        .setAlpha(.88)
        .setDepth(-.5);
    } else if (decoration.kind === "book-pile") {
      this.add.image(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, "libraryBooks")
        .setDisplaySize(decoration.w, decoration.h)
        .setDepth(1);
    } else if (decoration.kind === "cobweb-spider") {
      this.add.image(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, "libraryCobweb")
        .setDisplaySize(decoration.w, decoration.h)
        .setAlpha(.66)
        .setDepth(1);
    } else if (decoration.kind === "reading-lamp") {
      g.fillStyle(0xffdf8a, .18).fillCircle(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, 24);
      g.fillStyle(0xffd36c, .86).fillCircle(decoration.x + decoration.w / 2, decoration.y + decoration.h / 2, 6);
    }
  }
  addLibraryCandles(x: number, y: number) {
    const points = [{ x: -10, y: -7 }, { x: 9, y: -6 }, { x: 0, y: 7 }];
    for (const [index, point] of points.entries()) {
      const glow = this.add.circle(x + point.x, y + point.y - 7, 15, 0xffc45a, .13)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(3);
      const flame = this.add.sprite(x + point.x, y + point.y - 8, "libraryCandleFlame")
        .setDisplaySize(12, 12)
        .setDepth(4)
        .play({ key: "library-candle-flicker", startFrame: index * 2 });
      const glowTween = this.tweens.add({
        targets: glow,
        alpha: { from: .08, to: .18 },
        duration: 180 + index * 45,
        yoyo: true,
        repeat: -1,
      });
      const flameTween = this.tweens.add({
        targets: flame,
        alpha: { from: index === 1 ? .72 : .88, to: 1 },
        duration: 160 + index * 40,
        yoyo: true,
        repeat: -1,
      });
      this.libraryCandles.push({
        x: x + point.x,
        y: y + point.y - 8,
        lit: true,
        flame,
        glow,
        flameTween,
        glowTween,
      });
    }
  }
  createLibraryAtmosphere() {
    this.libraryDust = Array.from({ length: 34 }, (_, index) => ({
      x: Phaser.Math.Between(270, T.worldWidth - 270),
      y: Phaser.Math.Between(70, T.worldHeight - 70),
      speed: Phaser.Math.FloatBetween(3.5, 8),
      drift: Phaser.Math.FloatBetween(2, 7) * (index % 2 ? 1 : -1),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      size: Phaser.Math.FloatBetween(.8, 1.8),
      alpha: Phaser.Math.FloatBetween(.08, .2),
    }));
    const spiderRoutes = [
      { x: 420, y: 142, dx: 42, dy: 8, flip: false },
      { x: 1080, y: 684, dx: -38, dy: -6, flip: true },
    ];
    for (const [index, route] of spiderRoutes.entries()) {
      const spider = this.add.image(route.x, route.y, "librarySpider")
        .setDisplaySize(18, 18)
        .setFlipX(route.flip)
        .setAlpha(.82)
        .setDepth(3);
      this.tweens.add({
        targets: spider,
        x: route.x + route.dx,
        y: route.y + route.dy,
        angle: route.flip ? -8 : 8,
        duration: 3800 + index * 700,
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
        hold: 900 + index * 500,
        repeatDelay: 1200,
      });
    }
  }
  updateLibraryDust(dt: number) {
    if (this.level.theme !== "library") return;
    for (const dust of this.libraryDust) {
      dust.phase += dt * .7;
      dust.y -= dust.speed * dt;
      dust.x += Math.sin(dust.phase) * dust.drift * dt;
      if (dust.y < 55) {
        dust.y = T.worldHeight - 55;
        dust.x = Phaser.Math.Between(270, T.worldWidth - 270);
      }
    }
  }
  renderLibraryDust() {
    this.atmosphereGfx?.clear();
    if (this.level.theme !== "library") return;
    for (const dust of this.libraryDust) {
      const pulse = .72 + Math.sin(dust.phase * 1.7) * .28;
      this.atmosphereGfx.fillStyle(0xffe8b0, dust.alpha * pulse).fillCircle(dust.x, dust.y, dust.size);
    }
  }
  handleLibraryProjectileImpact(projectile: Projectile) {
    if (this.level.theme !== "library" || !this.libraryCandles.length) return;
    const lit = this.libraryCandles.filter((candle) => candle.lit);
    if (projectile.kind === "rocket") {
      for (const candle of lit) {
        if (len(candle.x - projectile.x, candle.y - projectile.y) <= T.rocketSplashRadius) this.extinguishLibraryCandle(candle);
      }
      return;
    }
    const nearest = lit
      .map((candle) => ({ candle, distance: len(candle.x - projectile.x, candle.y - projectile.y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance <= 54) this.extinguishLibraryCandle(nearest.candle);
  }
  extinguishLibraryCandle(candle: LibraryCandle) {
    candle.lit = false;
    candle.flameTween.stop();
    candle.glowTween.stop();
    this.tweens.add({ targets: [candle.flame, candle.glow], alpha: 0, duration: 130 });
  }

  layoutTouch() {
    this.joy.ox = Math.max(96, this.scale.width * .12);
    this.joy.oy = this.scale.height - 96;
    this.jumpBtn.x = this.scale.width - Math.max(84, this.scale.width * .09);
    this.jumpBtn.y = this.scale.height - 94;
    this.rocketBtn.x = this.jumpBtn.x - 96;
    this.rocketBtn.y = this.jumpBtn.y + 10;
    this.railBtn.x = this.jumpBtn.x - 190;
    this.railBtn.y = this.jumpBtn.y + 10;
  }
  pointerDown(p: Phaser.Input.Pointer) {
    if (Phaser.Math.Distance.Between(p.x, p.y, this.railBtn.x, this.railBtn.y) <= this.railBtn.r + 20 && this.railBtn.id < 0) {
      this.railBtn.id = p.id;
      this.railBtn.held = true;
      this.railBtn.dragged = false;
      this.railBtn.drag = 0;
      this.updateRailAim(p);
      return;
    }
    if (Phaser.Math.Distance.Between(p.x, p.y, this.rocketBtn.x, this.rocketBtn.y) <= this.rocketBtn.r + 24 && this.rocketBtn.id < 0) {
      this.rocketBtn.id = p.id;
      this.rocketBtn.held = true;
      this.rocketBtn.dragged = false;
      this.rocketBtn.drag = 0;
      this.updateRocketAim(p);
      return;
    }
    if (Phaser.Math.Distance.Between(p.x, p.y, this.jumpBtn.x, this.jumpBtn.y) <= this.jumpBtn.r + 24 && this.jumpBtn.id < 0) { this.jumpBtn.id = p.id; this.jumpBtn.held = true; this.jumpBtn.pressed = true; return; }
    if (p.x < this.scale.width * .58 && this.joy.id < 0) { this.joy.id = p.id; this.joy.active = true; this.joy.ox = p.x; this.joy.oy = p.y; this.pointerMove(p); }
  }
  pointerMove(p: Phaser.Input.Pointer) {
    if (p.id === this.railBtn.id) {
      this.updateRailAim(p);
      return;
    }
    if (p.id === this.rocketBtn.id) {
      this.updateRocketAim(p);
      return;
    }
    if (p.id !== this.joy.id) return;
    const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy, d = Math.hypot(dx, dy), r = 62;
    this.joy.x = d ? dx / d : 0; this.joy.y = d ? dy / d : 0; this.joy.len = Math.min(1, d / r);
  }
  pointerUp(p: Phaser.Input.Pointer) {
    if (p.id === this.joy.id) { this.joy.id = -1; this.joy.x = 0; this.joy.y = 0; this.joy.len = 0; this.layoutTouch(); }
    if (p.id === this.jumpBtn.id) { this.jumpBtn.id = -1; this.jumpBtn.held = false; }
    if (p.id === this.railBtn.id) {
      const dragged = this.railBtn.dragged;
      const cancelled = dragged && this.railBtn.drag < 18;
      if (!cancelled) {
        if (dragged) this.firePlayerRail({ x: this.railBtn.aimX, y: this.railBtn.aimY });
        else this.firePlayerRailAtNearest();
      }
      this.railBtn.id = -1;
      this.railBtn.held = false;
      this.railBtn.drag = 0;
      this.railBtn.dragged = false;
    }
    if (p.id === this.rocketBtn.id) {
      const dragged = this.rocketBtn.dragged;
      const cancelled = dragged && this.rocketBtn.drag < 18;
      if (!cancelled) {
        if (dragged) this.firePlayerRocket({ x: this.rocketBtn.aimX, y: this.rocketBtn.aimY });
        else this.firePlayerRocketAtNearest();
      }
      this.rocketBtn.id = -1;
      this.rocketBtn.held = false;
      this.rocketBtn.drag = 0;
      this.rocketBtn.dragged = false;
    }
  }
  drawTouch() {
    this.uiGfx.clear().fillStyle(0xffffff, .38).lineStyle(2, 0x17302d, .18).fillCircle(this.joy.ox, this.joy.oy, 62).strokeCircle(this.joy.ox, this.joy.oy, 62);
    this.uiGfx.fillStyle(0x17302d, .42).fillCircle(this.joy.ox + this.joy.x * this.joy.len * 48, this.joy.oy + this.joy.y * this.joy.len * 48, 22);
    this.uiGfx.fillStyle(this.jumpBtn.held ? 0xffd86b : 0xffffff, this.jumpBtn.held ? .84 : .52).lineStyle(3, this.jumpBtn.held ? 0xb77516 : 0x17302d, .28).fillCircle(this.jumpBtn.x, this.jumpBtn.y, this.jumpBtn.r).strokeCircle(this.jumpBtn.x, this.jumpBtn.y, this.jumpBtn.r);
    this.drawRocketButton();
    this.drawRailButton();
  }

  updateRocketAim(p: Phaser.Input.Pointer) {
    const dx = p.x - this.rocketBtn.x, dy = p.y - this.rocketBtn.y, d = Math.hypot(dx, dy);
    this.rocketBtn.drag = d;
    if (d > 10) {
      this.rocketBtn.aimX = dx / d;
      this.rocketBtn.aimY = dy / d;
    }
    if (d > 16) this.rocketBtn.dragged = true;
  }
  updateRailAim(p: Phaser.Input.Pointer) {
    const dx = p.x - this.railBtn.x, dy = p.y - this.railBtn.y, d = Math.hypot(dx, dy);
    this.railBtn.drag = d;
    if (d > 10) {
      this.railBtn.aimX = dx / d;
      this.railBtn.aimY = dy / d;
    }
    if (d > 16) this.railBtn.dragged = true;
  }

  drawRocketButton() {
    const ready = this.player.state === "alive" && this.player.rocketAmmo > 0;
    const active = this.rocketBtn.held && ready;
    if (!this.rocketButtonView) {
      this.rocketButtonView = this.add.image(this.rocketBtn.x, this.rocketBtn.y, "uiRocketButton").setScrollFactor(0).setDepth(1001).setScale(.38);
    }
    if (!this.ammoBadgeView) {
      this.ammoBadgeView = this.add.image(this.rocketBtn.x + 30, this.rocketBtn.y + 30, "uiAmmoBadge").setScrollFactor(0).setDepth(1002).setScale(.16);
    }
    if (!this.ammoText) {
      this.ammoText = this.add.text(this.rocketBtn.x + 30, this.rocketBtn.y + 30, "0", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        stroke: "#17211f",
        strokeThickness: 5,
      }).setOrigin(.5).setScrollFactor(0).setDepth(1003);
    }
    this.rocketButtonView
      .setPosition(this.rocketBtn.x, this.rocketBtn.y)
      .setScale(active ? .41 : .38)
      .setAlpha(ready ? 1 : .42);
    this.ammoBadgeView
      .setPosition(this.rocketBtn.x + 31, this.rocketBtn.y + 31)
      .setAlpha(ready ? .95 : .48);
    this.ammoText
      .setPosition(this.rocketBtn.x + 31, this.rocketBtn.y + 31)
      .setText(String(this.player.rocketAmmo))
      .setAlpha(ready ? 1 : .55);
    if (active && this.rocketBtn.dragged) {
      const len = Math.min(68, Math.max(28, this.rocketBtn.drag));
      this.uiGfx.lineStyle(5, 0xfff0b2, this.rocketBtn.drag < 18 ? .38 : .9)
        .beginPath()
        .moveTo(this.rocketBtn.x, this.rocketBtn.y)
        .lineTo(this.rocketBtn.x + this.rocketBtn.aimX * len, this.rocketBtn.y + this.rocketBtn.aimY * len)
        .strokePath();
    }
  }
  drawRailButton() {
    const hasAmmo = this.player.state === "alive" && this.player.railAmmo > 0;
    const ready = hasAmmo && this.player.railCooldown <= 0;
    const active = this.railBtn.held && ready;
    if (!this.railButtonView) {
      this.railButtonView = this.add.image(this.railBtn.x, this.railBtn.y, "uiRailButton").setScrollFactor(0).setDepth(1001).setScale(.38);
    }
    if (!this.railAmmoBadgeView) {
      this.railAmmoBadgeView = this.add.image(this.railBtn.x + 30, this.railBtn.y + 30, "uiRailBadge").setScrollFactor(0).setDepth(1002).setScale(.16);
    }
    if (!this.railAmmoText) {
      this.railAmmoText = this.add.text(this.railBtn.x + 30, this.railBtn.y + 30, "0", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        stroke: "#10281a",
        strokeThickness: 5,
      }).setOrigin(.5).setScrollFactor(0).setDepth(1003);
    }
    this.railButtonView
      .setPosition(this.railBtn.x, this.railBtn.y)
      .setScale(active ? .41 : .38)
      .setAlpha(ready ? 1 : hasAmmo ? .62 : .38);
    this.railAmmoBadgeView
      .setPosition(this.railBtn.x + 31, this.railBtn.y + 31)
      .setAlpha(hasAmmo ? .95 : .45);
    this.railAmmoText
      .setPosition(this.railBtn.x + 31, this.railBtn.y + 31)
      .setText(String(this.player.railAmmo))
      .setAlpha(hasAmmo ? 1 : .5);
    if (hasAmmo && !ready) {
      const cooldownRatio = Phaser.Math.Clamp(this.player.railCooldown / T.railCooldownMs, 0, 1);
      this.uiGfx.lineStyle(5, 0x62ff91, .72).beginPath()
        .arc(this.railBtn.x, this.railBtn.y, this.railBtn.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cooldownRatio))
        .strokePath();
    }
    if (active && this.railBtn.dragged) {
      const aimLength = Math.min(68, Math.max(28, this.railBtn.drag));
      this.uiGfx.lineStyle(5, 0xbaffd0, .92).beginPath()
        .moveTo(this.railBtn.x, this.railBtn.y)
        .lineTo(this.railBtn.x + this.railBtn.aimX * aimLength, this.railBtn.y + this.railBtn.aimY * aimLength)
        .strokePath();
    }
  }

  drawDigit(digit: string, x: number, y: number) {
    const segments: Record<string, number[]> = {
      "0": [0, 1, 2, 3, 4, 5],
      "1": [1, 2],
      "2": [0, 1, 6, 4, 3],
      "3": [0, 1, 6, 2, 3],
      "4": [5, 6, 1, 2],
      "5": [0, 5, 6, 2, 3],
      "6": [0, 5, 6, 4, 3, 2],
      "7": [0, 1, 2],
      "8": [0, 1, 2, 3, 4, 5, 6],
      "9": [0, 1, 2, 3, 5, 6],
    };
    const lines = [
      [x, y, x + 7, y], [x + 7, y, x + 7, y + 6], [x + 7, y + 7, x + 7, y + 13],
      [x, y + 13, x + 7, y + 13], [x, y + 7, x, y + 13], [x, y, x, y + 6], [x, y + 6, x + 7, y + 6],
    ];
    this.uiGfx.lineStyle(2, 0xffffff, .96);
    for (const index of segments[digit] ?? []) this.uiGfx.beginPath().moveTo(lines[index][0], lines[index][1]).lineTo(lines[index][2], lines[index][3]).strokePath();
  }

  firePlayerRocketAtNearest() {
    const target = this.bots
      .filter((b) => b.alive && b.team !== this.player.team && !this.level.walls.some((w) => lineIntersectsRect(this.player, b, w)))
      .sort((a, b) => len(this.player.x - a.x, this.player.y - a.y) - len(this.player.x - b.x, this.player.y - b.y))[0];
    if (target) this.firePlayerRocket({ x: target.x - this.player.x, y: target.y - this.player.y });
    else this.firePlayerRocket(this.player.lastMoveDir);
  }

  firePlayerRocket(direction: Vec2) {
    if (this.player.state !== "alive" || this.player.rocketAmmo <= 0) return;
    const d = len(direction.x, direction.y);
    if (d < .001) return;
    const nx = direction.x / d, ny = direction.y / d;
    this.player.rocketAmmo--;
    this.projectiles.push(new Projectile(
      this.player.x + nx * (this.player.radius + T.rocketProjectileRadius + 3),
      this.player.y - this.player.jump.height + ny * (this.player.radius + T.rocketProjectileRadius + 3),
      nx * T.rocketSpeed,
      ny * T.rocketSpeed,
      this.player,
      "rocket",
    ));
  }
  firePlayerRailAtNearest() {
    const target = this.bots
      .filter((bot) => bot.alive && bot.team !== this.player.team)
      .filter((bot) => !this.level.walls.some((wall) => lineIntersectsRect(this.player, bot, wall)))
      .filter((bot) => len(this.player.x - bot.x, this.player.y - bot.y) <= T.railRange)
      .sort((a, b) => len(this.player.x - a.x, this.player.y - a.y) - len(this.player.x - b.x, this.player.y - b.y))[0];
    if (target) this.firePlayerRail({ x: target.x - this.player.x, y: target.y - this.player.y });
    else this.firePlayerRail(this.player.lastMoveDir);
  }
  firePlayerRail(direction: Vec2) {
    this.fireRailgun(this.player, direction, [this.player, ...this.bots]);
  }
  updateHud() {
    document.querySelector("#red-score")!.textContent = String(this.flags.redScore);
    document.querySelector("#blue-score")!.textContent = String(this.flags.blueScore);
    document.querySelector("#flag-state")!.textContent = this.flags.text(this.player);
    document.querySelector("#player-hp")!.textContent = `${Math.max(0, Math.ceil(this.player.hp))}/${T.playerMaxHp}`;
    document.querySelector("#player-armor")!.textContent = String(Math.max(0, Math.ceil(this.player.armor)));
    const weapons = [
      this.player.rocketAmmo > 0 ? `Rocket x${this.player.rocketAmmo}` : "",
      this.player.railAmmo > 0 ? `Rail x${this.player.railAmmo}` : "",
    ].filter(Boolean);
    document.querySelector("#weapon")!.textContent = weapons.join(" | ") || "Auto";
    document.querySelector("#speed")!.textContent = this.player.speed().toFixed(0);
    document.querySelector("#jump")!.textContent = this.player.jump.state();
    document.querySelector("#capture")!.textContent = this.flags.capture(this.player);
    const debug = document.querySelector("#debug")!;
    debug.classList.toggle("is-hidden", !this.debugVisible);
    debug.classList.toggle("is-visible", this.debugVisible);
    debug.textContent = `speed: ${this.player.speed().toFixed(1)}
velocity: ${this.player.vx.toFixed(1)}, ${this.player.vy.toFixed(1)}
state: ${this.player.state}
jump height: ${this.player.jump.height.toFixed(1)}
jump charge: ${Math.round(this.player.jump.charge() * 100)}%
friction: ${this.player.movement.currentFriction.toFixed(2)}
carried flag: ${this.player.carriedFlag ?? "none"}
armor: ${Math.ceil(this.player.armor)}
weapon: rocket ${this.player.rocketAmmo}, rail ${this.player.railAmmo}, rail cd ${Math.ceil(this.player.railCooldown)}
projectiles: ${this.projectiles.length}
teams: ${this.redCount}v${this.blueCount}
bot hp: ${this.bots.map((b) => `${b.team}-${b.role}-${b.state}:${Math.max(0, Math.ceil(b.hp))}`).join(", ")}
nearest enemy: ${Math.min(...this.bots.filter((b) => b.alive && b.team !== this.player.team).map((b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y)), 9999).toFixed(0)}
over gap: ${this.player.overGap ? "yes" : "no"}
last safe: ${this.player.lastSafe.x.toFixed(0)}, ${this.player.lastSafe.y.toFixed(0)}`;
  }

  setupHudButtons() {
    const panel = document.querySelector("#settings-panel");
    const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button");
    if (settingsButton) settingsButton.onclick = () => {
      panel?.classList.toggle("is-hidden");
    };

    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-map]"))) {
      const mapId = button.dataset.map as LevelId;
      button.classList.toggle("is-active", mapId === this.levelId);
      button.title = LEVEL_BY_ID[mapId]?.plan ?? "";
      button.onclick = () => {
        if (!LEVELS.some((level) => level.id === mapId)) return;
        panel?.classList.add("is-hidden");
        this.restartWithSettings(mapId);
      };
    }

    const redSelect = document.querySelector<HTMLSelectElement>("#red-count");
    const blueSelect = document.querySelector<HTMLSelectElement>("#blue-count");
    if (redSelect) {
      redSelect.value = String(this.redCount);
      redSelect.onchange = () => {
        this.redCount = this.teamCount(Number(redSelect.value), this.redCount);
        this.restartWithSettings();
      };
    }
    if (blueSelect) {
      blueSelect.value = String(this.blueCount);
      blueSelect.onchange = () => {
        this.blueCount = this.teamCount(Number(blueSelect.value), this.blueCount);
        this.restartWithSettings();
      };
    }

    const debugButton = document.querySelector<HTMLButtonElement>("#debug-button");
    if (debugButton) debugButton.onclick = () => {
      this.debugVisible = !this.debugVisible;
    };

    const fullscreenButton = document.querySelector<HTMLButtonElement>("#fullscreen-button");
    if (fullscreenButton) fullscreenButton.onclick = async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    };
  }
}
