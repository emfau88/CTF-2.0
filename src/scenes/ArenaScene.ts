import Phaser from "phaser";
import { ArenaAudio } from "../arenaAudio";
import { ArenaEffects } from "../arenaEffects";
import { renderArena } from "../arenaRenderer";
import { preloadArenaAssets } from "../assets";
import { createTeamBots } from "../botFactory";
import { T, TEAM } from "../config";
import {
  LEVEL_BY_ID,
  LEVELS,
  type LevelData,
  type LevelId,
} from "../level";
import { HudController } from "../hud";
import { LibraryEffects } from "../libraryEffects";
import { MatchFlow } from "../matchFlow";
import {
  len,
  lineIntersectsRect,
  rayCircleDistance,
  rayRectDistance,
  type InputVector,
  type Rect,
  type Vec2,
} from "../math";
import { Player } from "../player";
import { AutoAttack, Bot, CollisionSystem, FlagSystem, Pickup, PickupSystem, Projectile } from "../systems";
import { findNearestVisibleEnemy } from "../targeting";
import { calculateTouchLayout } from "../touchLayout";

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
  whipKey!: Phaser.Input.Keyboard.Key;
  joy = { active: false, id: -1, ox: 110, oy: 500, x: 0, y: 0, len: 0, r: 62, knobR: 22 };
  jumpBtn = { id: -1, x: 0, y: 0, r: 52, held: false, pressed: false };
  rocketBtn = { id: -1, x: 0, y: 0, r: 43, held: false, aimX: 1, aimY: 0, drag: 0, dragged: false };
  railBtn = { id: -1, x: 0, y: 0, r: 43, held: false, aimX: 1, aimY: 0, drag: 0, dragged: false };
  whipBtn = { x: 0, y: 0, r: 43 };
  gfx!: Phaser.GameObjects.Graphics;
  uiGfx!: Phaser.GameObjects.Graphics;
  playerBody!: Phaser.GameObjects.Sprite;
  playerRing!: Phaser.GameObjects.Arc;
  shadow!: Phaser.GameObjects.Ellipse;
  botViews = new Map<Bot, Phaser.GameObjects.Sprite>();
  botCharacterRows = new Map<Bot, number>();
  projectileViews = new Map<Projectile, Phaser.GameObjects.Ellipse>();
  rocketViews = new Map<Projectile, Phaser.GameObjects.Image>();
  pickupViews = new Map<Pickup, Phaser.GameObjects.Container>();
  flagViews = new Map<string, Phaser.GameObjects.Image>();
  rocketButtonView?: Phaser.GameObjects.Image;
  ammoBadgeView?: Phaser.GameObjects.Image;
  ammoText?: Phaser.GameObjects.Text;
  railButtonView?: Phaser.GameObjects.Image;
  railAmmoBadgeView?: Phaser.GameObjects.Image;
  railAmmoText?: Phaser.GameObjects.Text;
  whipButtonView?: Phaser.GameObjects.Image;
  whipAmmoBadgeView?: Phaser.GameObjects.Image;
  whipAmmoText?: Phaser.GameObjects.Text;
  botAlive = new Map<Bot, boolean>();
  audio!: ArenaAudio;
  effects!: ArenaEffects;
  libraryEffects!: LibraryEffects;
  lastState = "alive";
  hud = new HudController();
  match!: MatchFlow;
  menuOpen = false;

  preload() {
    preloadArenaAssets(this);
  }

  create(data?: { mapId?: LevelId; redCount?: number; blueCount?: number; startPlaying?: boolean }) {
    this.resetViewState();
    const saved = this.loadMatchPreferences();
    this.levelId = data?.mapId && LEVEL_BY_ID[data.mapId]
      ? data.mapId
      : saved.mapId && LEVEL_BY_ID[saved.mapId]
        ? saved.mapId
        : "training-crossing";
    this.redCount = this.teamCount(data?.redCount ?? saved.redCount, 1);
    this.blueCount = this.teamCount(data?.blueCount ?? saved.blueCount, 2);
    this.menuOpen = data?.startPlaying !== true && new URLSearchParams(window.location.search).get("play") !== "1";
    this.level = LEVEL_BY_ID[this.levelId];
    this.player = new Player(this.level.redSpawn.x, this.level.redSpawn.y, "red");
    this.bots = [
      ...createTeamBots(this.level, "red", Math.max(0, this.redCount - 1)),
      ...createTeamBots(this.level, "blue", this.blueCount),
    ];
    this.collision = new CollisionSystem(this.level);
    this.flags = new FlagSystem(this.level);
    this.match = new MatchFlow(T.matchScoreLimit, T.matchDurationMs, T.matchCountdownMs);
    this.pickups = new PickupSystem(this.level.pickups);
    this.auto = new AutoAttack(this.player, this.projectiles);
    this.botAutos = new Map(this.bots.map((bot) => [bot, new AutoAttack(bot, this.projectiles, T.botFireRate)]));
    this.botAlive = new Map(this.bots.map((bot) => [bot, bot.alive]));
    this.botCharacterRows = new Map();
    for (const team of ["red", "blue"] as const) {
      this.bots
        .filter((bot) => bot.team === team)
        .forEach((bot, index) => this.botCharacterRows.set(bot, (team === "red" ? 1 : 4) + index));
    }

    if (!this.anims.exists("library-candle-flicker")) {
      this.anims.create({
        key: "library-candle-flicker",
        frames: this.anims.generateFrameNumbers("libraryCandleFlame", { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
        yoyo: true,
      });
    }
    this.libraryEffects = new LibraryEffects(this);
    renderArena(this, this.level, (x, y) => this.libraryEffects.addCandles(x, y));
    if (this.level.theme === "library") this.libraryEffects.createAtmosphere();
    this.audio = new ArenaAudio(this);
    this.effects = new ArenaEffects(this);
    this.gfx = this.add.graphics().setDepth(40);
    this.uiGfx = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.shadow = this.add.ellipse(this.player.x, this.player.y + 8, 34, 14, 0x000000, .2).setDepth(20);
    this.playerBody = this.add.sprite(this.player.x, this.player.y, "arenaCharacters", 1).setScale(.42).setDepth(35);
    this.playerRing = this.add.circle(this.player.x, this.player.y, this.player.radius + 4).setVisible(false);
    for (const b of this.bots) {
      const row = this.botCharacterRows.get(b) ?? (b.team === "red" ? 1 : 4);
      this.botViews.set(b, this.add.sprite(b.x, b.y, "arenaCharacters", row * 4 + 1).setScale(.42).setDepth(32));
    }

    if (!this.input.keyboard) throw new Error("keyboard unavailable");
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: "W", down: "S", left: "A", right: "D" }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.whipKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.input.keyboard.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT", "W", "A", "S", "D", "F"]);
    this.input.addPointer(2);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.pointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.pointerMove(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.pointerUp(p));
    this.scale.on("resize", () => this.layoutTouch());
    this.layoutTouch();
    this.setupHudButtons();
    if (this.menuOpen) this.openMainMenu();
    else this.hud.hideMainMenu();

    this.cameras.main.setBounds(0, 0, T.worldWidth, T.worldHeight);
    this.cameras.main.startFollow(this.playerBody, true, .12, .12);
  }

  resetViewState() {
    this.botViews = new Map();
    this.botCharacterRows = new Map();
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
    this.whipButtonView = undefined;
    this.whipAmmoBadgeView = undefined;
    this.whipAmmoText = undefined;
    this.lastState = "alive";
    this.hud.reset();
  }

  update(_t: number, delta: number) {
    if (this.menuOpen) {
      this.render();
      return;
    }
    this.match.update(Math.min(delta, 1000), this.flags.redScore, this.flags.blueScore);
    if (this.match.phase !== "playing") {
      this.jumpBtn.pressed = false;
      this.joy.x = 0;
      this.joy.y = 0;
      this.joy.len = 0;
      this.render();
      return;
    }

    const ms = Math.min(delta, 34), dt = ms / 1000;
    this.player.railCooldown = Math.max(0, this.player.railCooldown - ms);
    this.player.whipCooldown = Math.max(0, this.player.whipCooldown - ms);
    const input = this.inputVector();
    if (input.length > .05) this.player.lastMoveDir = { x: input.x, y: input.y };
    if ((Phaser.Input.Keyboard.JustDown(this.jumpKey) || this.jumpBtn.pressed) && this.player.jump.start()) {
      this.audio.playJump();
    }
    this.jumpBtn.pressed = false;
    if (Phaser.Input.Keyboard.JustDown(this.whipKey)) this.firePlayerWhipAtNearest();
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
      if (this.player.state === "dead") {
        this.effects.addDeathBurst(this.player.x, this.player.y - this.player.jump.height, this.player.team);
        this.dropWeaponAmmo(this.player);
      }
    }
    this.lastState = this.player.state;

    const blockers: Rect[] = [...this.level.walls, ...this.level.gaps];
    const actors = [this.player, ...this.bots];
    for (const b of this.bots) b.update(dt, ms, blockers, this.flags, actors, this.level.walls, this.pickups.pickups);
    for (const p of this.projectiles) {
      const wasDead = p.dead;
      p.update(dt, ms, [...this.bots, this.player], this.level.walls);
      if (!wasDead && p.dead && this.level.theme === "library") this.libraryEffects.handleProjectileImpact(p);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].dead) {
        this.effects.projectileRemoved(this.projectiles[i]);
        this.projectiles.splice(i, 1);
      }
    }
    const playerShot = this.auto.update(ms, this.bots, this.level.walls);
    if (playerShot?.kind === "bullet") this.audio.playBulletFire();
    for (const b of this.bots) {
      const shot = this.botAutos.get(b)?.update(ms, actors, this.level.walls);
      if (shot) this.audio.playBotWeapon(b, this.player, shot.kind);
    }
    for (const b of this.bots) {
      const wasAlive = this.botAlive.get(b) ?? b.alive;
      if (wasAlive && !b.alive) {
        this.flags.failed(b);
        this.effects.addDeathBurst(b.x, b.y, b.team);
        this.audio.playBotDeath(b, this.player);
        this.dropWeaponAmmo(b);
      }
      this.botAlive.set(b, b.alive);
    }
    this.flags.update(this.player);
    this.match.update(0, this.flags.redScore, this.flags.blueScore);
    const collectedPickups = this.pickups.update(ms, actors);
    for (const { pickup, actor } of collectedPickups) {
      if (actor === this.player) {
        if (pickup.kind === "health") this.audio.playHealthPickup();
        else if (pickup.kind === "armor") this.audio.playPowerup();
        else this.audio.playWeaponPickup();
      } else if (actor instanceof Bot) {
        this.audio.playBotPickup(actor, this.player, pickup.kind);
      }
    }
    this.audio.update(ms, this.player, this.bots);
    this.effects.update(ms, this.player, this.projectiles, this.pickups.pickups);
    if (this.level.theme === "library") this.libraryEffects.update(dt);
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

  restartWithSettings(mapId: LevelId = this.levelId) {
    this.saveMatchPreferences(mapId, this.redCount, this.blueCount);
    this.scene.restart({ mapId, redCount: this.redCount, blueCount: this.blueCount, startPlaying: true });
  }

  openMainMenu() {
    this.menuOpen = true;
    this.hud.showMainMenu({
      levelId: this.levelId,
      redCount: this.redCount,
      blueCount: this.blueCount,
      onPlay: (mapId, redCount, blueCount) => {
        this.redCount = this.teamCount(redCount, this.redCount);
        this.blueCount = this.teamCount(blueCount, this.blueCount);
        this.saveMatchPreferences(mapId, this.redCount, this.blueCount);
        this.scene.restart({
          mapId,
          redCount: this.redCount,
          blueCount: this.blueCount,
          startPlaying: true,
        });
      },
    });
  }

  loadMatchPreferences() {
    try {
      const value = JSON.parse(localStorage.getItem("ctf-match-settings") ?? "{}");
      return {
        mapId: value.mapId as LevelId | undefined,
        redCount: Number(value.redCount) || undefined,
        blueCount: Number(value.blueCount) || undefined,
      };
    } catch {
      return {};
    }
  }

  saveMatchPreferences(mapId: LevelId, redCount: number, blueCount: number) {
    try {
      localStorage.setItem("ctf-match-settings", JSON.stringify({ mapId, redCount, blueCount }));
    } catch {
      // The match still starts when storage is unavailable.
    }
  }

  render() {
    if (this.level.theme === "library") this.libraryEffects.render();
    this.gfx.clear();
    this.effects.renderBeforeActors(this.gfx, this.time.now);
    this.renderFlags();
    this.renderPickups();
    this.effects.renderRocketSmoke();
    this.renderPlayer();
    for (const b of this.bots) {
      const row = this.botCharacterRows.get(b) ?? (b.team === "red" ? 1 : 4);
      this.botViews.get(b)
        ?.setPosition(b.x, b.y)
        .setFrame(row * 4 + this.directionFrame(b.vx, b.vy))
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
          this.projectileViews.set(
            p,
            this.add.ellipse(p.x, p.y, p.radius * 2.7, p.radius * .9, color, .98)
              .setStrokeStyle(1.5, 0xffffff, .9)
              .setDepth(50),
          );
        }
        this.projectileViews.get(p)
          ?.setPosition(p.x, p.y)
          .setDisplaySize(p.radius * 2.7, p.radius * .9)
          .setRotation(Math.atan2(p.vy, p.vx))
          .setFillStyle(color, .98);
      }
    }
    for (const [p, v] of this.projectileViews) if (p.dead) { v.destroy(); this.projectileViews.delete(p); }
    for (const [p, v] of this.rocketViews) if (p.dead) { v.destroy(); this.rocketViews.delete(p); }
    this.renderRocketAim();
    this.renderRailAim();
    this.drawTouch();
    this.hud.updateArena(this.time.now, {
      player: this.player,
      bots: this.bots,
      projectiles: this.projectiles,
      redCount: this.redCount,
      blueCount: this.blueCount,
      redScore: this.flags.redScore,
      blueScore: this.flags.blueScore,
      redFlagCarried: Boolean(this.flags.flags.red.carrier),
      blueFlagCarried: Boolean(this.flags.flags.blue.carrier),
      matchPhase: this.match.phase,
      matchTimeRemaining: this.match.timeRemaining,
      matchCountdown: this.match.countdownValue,
      matchWinner: this.match.winner,
    });
  }

  renderPlayer() {
    const h = this.player.jump.height, s = Math.min(1, this.player.speed() / T.maxSpeed), scale = 1 + h / 210;
    this.shadow.setPosition(this.player.x, this.player.y + 8).setScale(1 + h / 160, Math.max(.35, 1 - h / 95)).setAlpha(this.player.state === "alive" ? Math.max(.1, .22 - h / 330) : 0);
    this.playerBody
      .setPosition(this.player.x, this.player.y - h)
      .setFrame(this.directionFrame(this.player.lastMoveDir.x, this.player.lastMoveDir.y))
      .setScale(.42 * scale)
      .setAlpha(this.player.state === "alive" ? 1 : .35)
      .setTint(this.player.state === "falling" ? 0x555555 : 0xffffff)
      .setVisible(this.player.state !== "dead");
    if (this.player.state === "alive") {
      this.drawHpBar(this.player.x - 22, this.player.y - h - 38, 44, 6, this.player.hp / T.playerMaxHp, TEAM.red.dark);
      if (this.player.armor > 0) {
        this.gfx.lineStyle(4, 0x29c46a, .95).beginPath().arc(this.player.x, this.player.y - h, this.player.radius * scale + 9, -2.55, -.6).strokePath();
      }
    }
  }

  directionFrame(x: number, y: number) {
    if (Math.abs(x) > Math.abs(y)) return x >= 0 ? 1 : 3;
    return y >= 0 ? 2 : 0;
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
      icon?.setVisible(pickup.active).setScale(this.pickupIconScale(pickup) + Math.sin(age * 3.2) * .008).setAlpha(pickup.active ? 1 : .2);
      label?.setVisible(pickup.active && pickup.temporary);
    }
    for (const [pickup, view] of this.pickupViews) {
      if (!this.pickups.pickups.includes(pickup)) {
        view.destroy(true);
        this.pickupViews.delete(pickup);
      }
    }
    this.effects.renderSpawnPadParticles(this.gfx);
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
    if (actor instanceof Player && actor.whipAmmo > 0) {
      this.pickups.dropWhipAmmo(actor.x, actor.y + 18, actor.whipAmmo);
      actor.whipAmmo = 0;
    }
  }

  createPickupView(pickup: Pickup) {
    const container = this.add.container(pickup.x, pickup.y).setDepth(18);
    const iconKey = pickup.kind === "health" ? "pickupHealth"
      : pickup.kind === "armor" ? "pickupArmor"
        : pickup.kind === "rocket" ? "pickupRocket"
          : pickup.kind === "rail" ? "pickupRail" : "pickupWhip";
    const weapon = pickup.kind === "rocket" || pickup.kind === "rail" || pickup.kind === "whip";
    const icon = this.add.image(0, weapon ? -3 : -5, iconKey).setName("icon").setScale(this.pickupIconScale(pickup)).setDepth(1);
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

  pickupIconScale(pickup: Pickup) {
    if (pickup.temporary) return .17;
    if (pickup.kind === "rail") return .22;
    if (pickup.kind === "whip") return .34;
    return .18;
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
    for (const wall of this.level.walls) distance = Math.min(distance, rayRectDistance(start, { x: dx, y: dy }, wall) ?? distance);
    let hit: Player | Bot | null = null;
    for (const target of targets) {
      if (target === owner || target.team === owner.team) continue;
      if (target instanceof Bot && !target.alive) continue;
      if (target instanceof Player && target.state !== "alive") continue;
      const targetDistance = rayCircleDistance(start, { x: dx, y: dy }, target, target.radius + 5);
      if (targetDistance === null || targetDistance >= distance) continue;
      distance = targetDistance;
      hit = target;
    }
    const end = { x: start.x + dx * distance, y: start.y + dy * distance };
    if (hit) {
      const maxHp = hit instanceof Player ? T.playerMaxHp : T.botMaxHp;
      hit.damage(maxHp * T.railDamageRatio);
    }
    if (this.level.theme === "library") this.libraryEffects.extinguishAlongSegment(start, end);
    owner.railAmmo--;
    owner.railCooldown = T.railCooldownMs;
    this.effects.addRailBeam(start, end, Boolean(hit));
    return hit ? "hit" : "miss";
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

  layoutTouch() {
    const layout = calculateTouchLayout(this.scale.width, this.scale.height);
    Object.assign(this.joy, layout.joy);
    Object.assign(this.jumpBtn, layout.jump);
    Object.assign(this.rocketBtn, layout.rocket);
    Object.assign(this.railBtn, layout.rail);
    Object.assign(this.whipBtn, layout.whip);
  }
  pointerDown(p: Phaser.Input.Pointer) {
    if (this.match.phase !== "playing") return;
    if (this.player.whipAmmo > 0 && Phaser.Math.Distance.Between(p.x, p.y, this.whipBtn.x, this.whipBtn.y) <= this.whipBtn.r + 20) {
      this.firePlayerWhipAtNearest();
      return;
    }
    if (this.player.railAmmo > 0 && Phaser.Math.Distance.Between(p.x, p.y, this.railBtn.x, this.railBtn.y) <= this.railBtn.r + 20 && this.railBtn.id < 0) {
      this.railBtn.id = p.id;
      this.railBtn.held = true;
      this.railBtn.dragged = false;
      this.railBtn.drag = 0;
      this.updateRailAim(p);
      return;
    }
    if (this.player.rocketAmmo > 0 && Phaser.Math.Distance.Between(p.x, p.y, this.rocketBtn.x, this.rocketBtn.y) <= this.rocketBtn.r + 24 && this.rocketBtn.id < 0) {
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
    const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy, d = Math.hypot(dx, dy), r = this.joy.r;
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
    const joyTravel = this.joy.r - this.joy.knobR + 8;
    this.uiGfx.clear().fillStyle(0xffffff, .38).lineStyle(2, 0x17302d, .18).fillCircle(this.joy.ox, this.joy.oy, this.joy.r).strokeCircle(this.joy.ox, this.joy.oy, this.joy.r);
    this.uiGfx.fillStyle(0x17302d, .42).fillCircle(this.joy.ox + this.joy.x * this.joy.len * joyTravel, this.joy.oy + this.joy.y * this.joy.len * joyTravel, this.joy.knobR);
    this.uiGfx.fillStyle(this.jumpBtn.held ? 0xffd86b : 0xffffff, this.jumpBtn.held ? .84 : .52).lineStyle(3, this.jumpBtn.held ? 0xb77516 : 0x17302d, .28).fillCircle(this.jumpBtn.x, this.jumpBtn.y, this.jumpBtn.r).strokeCircle(this.jumpBtn.x, this.jumpBtn.y, this.jumpBtn.r);
    this.drawRocketButton();
    this.drawRailButton();
    this.drawWhipButton();
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
    const compact = this.rocketBtn.r <= 36;
    const buttonScale = compact ? .27 : .38;
    const badgeOffset = compact ? 24 : 31;
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
      .setScale(active ? buttonScale + .025 : buttonScale)
      .setAlpha(ready ? 1 : .42)
      .setVisible(ready);
    this.ammoBadgeView
      .setPosition(this.rocketBtn.x + badgeOffset, this.rocketBtn.y + badgeOffset)
      .setScale(compact ? .12 : .16)
      .setAlpha(ready ? .95 : .48)
      .setVisible(ready);
    this.ammoText
      .setPosition(this.rocketBtn.x + badgeOffset, this.rocketBtn.y + badgeOffset)
      .setFontSize(compact ? 14 : 17)
      .setText(String(this.player.rocketAmmo))
      .setAlpha(ready ? 1 : .55)
      .setVisible(ready);
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
    const compact = this.railBtn.r <= 36;
    const buttonScale = compact ? .27 : .38;
    const badgeOffset = compact ? 24 : 31;
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
      .setScale(active ? buttonScale + .025 : buttonScale)
      .setAlpha(ready ? 1 : hasAmmo ? .62 : .38)
      .setVisible(hasAmmo);
    this.railAmmoBadgeView
      .setPosition(this.railBtn.x + badgeOffset, this.railBtn.y + badgeOffset)
      .setScale(compact ? .12 : .16)
      .setAlpha(hasAmmo ? .95 : .45)
      .setVisible(hasAmmo);
    this.railAmmoText
      .setPosition(this.railBtn.x + badgeOffset, this.railBtn.y + badgeOffset)
      .setFontSize(compact ? 14 : 17)
      .setText(String(this.player.railAmmo))
      .setAlpha(hasAmmo ? 1 : .5)
      .setVisible(hasAmmo);
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

  drawWhipButton() {
    const hasAmmo = this.player.state === "alive" && this.player.whipAmmo > 0;
    const ready = hasAmmo && this.player.whipCooldown <= 0;
    const compact = this.whipBtn.r <= 36;
    const buttonScale = compact ? .42 : .54;
    const badgeOffset = compact ? 24 : 31;
    if (!this.whipButtonView) {
      this.whipButtonView = this.add.image(this.whipBtn.x, this.whipBtn.y, "uiWhipButton").setScrollFactor(0).setDepth(1001).setScale(.38);
    }
    if (!this.whipAmmoBadgeView) {
      this.whipAmmoBadgeView = this.add.image(this.whipBtn.x + 30, this.whipBtn.y + 30, "uiAmmoBadge").setScrollFactor(0).setDepth(1002).setScale(.16);
    }
    if (!this.whipAmmoText) {
      this.whipAmmoText = this.add.text(this.whipBtn.x + 30, this.whipBtn.y + 30, "0", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        stroke: "#2b1c36",
        strokeThickness: 5,
      }).setOrigin(.5).setScrollFactor(0).setDepth(1003);
    }
    this.whipButtonView
      .setPosition(this.whipBtn.x, this.whipBtn.y)
      .setScale(buttonScale)
      .setAlpha(ready ? 1 : hasAmmo ? .58 : .35)
      .setVisible(hasAmmo);
    this.whipAmmoBadgeView
      .setPosition(this.whipBtn.x + badgeOffset, this.whipBtn.y + badgeOffset)
      .setScale(compact ? .12 : .16)
      .setVisible(hasAmmo);
    this.whipAmmoText
      .setPosition(this.whipBtn.x + badgeOffset, this.whipBtn.y + badgeOffset)
      .setFontSize(compact ? 14 : 17)
      .setText(String(this.player.whipAmmo))
      .setVisible(hasAmmo);
    if (hasAmmo && !ready) {
      const cooldownRatio = Phaser.Math.Clamp(this.player.whipCooldown / T.whipCooldownMs, 0, 1);
      this.uiGfx.lineStyle(5, 0xf4b35d, .72).beginPath()
        .arc(this.whipBtn.x, this.whipBtn.y, this.whipBtn.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cooldownRatio))
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
    const target = findNearestVisibleEnemy(this.player, this.bots, this.level.walls);
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
    this.audio.playRocketFire();
  }
  firePlayerRailAtNearest() {
    const target = findNearestVisibleEnemy(this.player, this.bots, this.level.walls, T.railRange);
    if (target) this.firePlayerRail({ x: target.x - this.player.x, y: target.y - this.player.y });
    else this.firePlayerRail(this.player.lastMoveDir);
  }
  firePlayerRail(direction: Vec2) {
    const result = this.fireRailgun(this.player, direction, [this.player, ...this.bots]);
    if (!result) return;
    this.audio.playRailFire();
    if (result === "hit") this.audio.playRailHitConfirm();
  }

  firePlayerWhipAtNearest() {
    let target: Bot | null = null;
    let bestDistance = Infinity;
    for (const bot of this.bots) {
      if (!bot.alive || bot.team === this.player.team) continue;
      const distance = len(bot.x - this.player.x, bot.y - this.player.y);
      if (distance > T.whipRange + bot.radius || distance >= bestDistance) continue;
      if (this.level.walls.some((wall) => lineIntersectsRect(this.player, bot, wall))) continue;
      target = bot;
      bestDistance = distance;
    }
    const direction = target
      ? { x: target.x - this.player.x, y: target.y - this.player.y }
      : this.player.lastMoveDir;
    this.firePlayerWhip(direction);
  }

  firePlayerWhip(direction: Vec2) {
    if (this.player.state !== "alive" || this.player.whipAmmo <= 0 || this.player.whipCooldown > 0) return;
    const magnitude = len(direction.x, direction.y);
    if (magnitude < .001) return;
    const normalized = { x: direction.x / magnitude, y: direction.y / magnitude };
    const minimumDot = Math.cos(T.whipHalfAngle);
    let hit: Bot | null = null;
    let bestDistance = Infinity;
    for (const bot of this.bots) {
      if (!bot.alive || bot.team === this.player.team) continue;
      const dx = bot.x - this.player.x, dy = bot.y - this.player.y;
      const distance = len(dx, dy);
      if (distance > T.whipRange + bot.radius || distance >= bestDistance) continue;
      if ((dx * normalized.x + dy * normalized.y) / (distance || 1) < minimumDot) continue;
      if (this.level.walls.some((wall) => lineIntersectsRect(this.player, bot, wall))) continue;
      hit = bot;
      bestDistance = distance;
    }
    this.player.whipAmmo--;
    this.player.whipCooldown = T.whipCooldownMs;
    if (hit) hit.damage(T.whipDamage);
    this.effects.addWhipSwing(this.player.x, this.player.y - this.player.jump.height, normalized, Boolean(hit));
    this.audio.playWhip(Boolean(hit));
  }
  setupHudButtons() {
    this.hud.bindMatchActions(
      () => this.restartWithSettings(),
      () => this.openMainMenu(),
    );
    this.hud.bindSettings({
      levelId: this.levelId,
      levels: LEVELS,
      redCount: this.redCount,
      blueCount: this.blueCount,
      onMapChange: (mapId) => {
        if (!LEVELS.some((level) => level.id === mapId)) return;
        this.restartWithSettings(mapId);
      },
      onRedCountChange: (count) => {
        this.redCount = this.teamCount(count, this.redCount);
        this.restartWithSettings();
      },
      onBlueCountChange: (count) => {
        this.blueCount = this.teamCount(count, this.blueCount);
        this.restartWithSettings();
      },
      onMainMenu: () => this.openMainMenu(),
    });
  }
}
