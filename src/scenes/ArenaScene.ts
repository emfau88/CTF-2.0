import Phaser from "phaser";
import { T, TEAM } from "../config";
import { LEVEL_BY_ID, LEVELS, type LevelData, type LevelId } from "../level";
import { len, lineIntersectsRect, type InputVector, type Rect, type Vec2 } from "../math";
import { Player } from "../player";
import { AutoAttack, Bot, CollisionSystem, FlagSystem, Pickup, PickupSystem, Projectile, type BotRole } from "../systems";

type Trail = { x: number; y: number; life: number; max: number; air: boolean; speed: number };
type RocketSmokeFx = { x: number; y: number; life: number; max: number; frame: number; scale: number; rotation: number; view?: Phaser.GameObjects.Image };
type ExplosionFx = { x: number; y: number; life: number; max: number; view?: Phaser.GameObjects.Image };
type SpawnPadParticle = { x: number; y: number; ox: number; life: number; max: number; size: number };

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
  gfx!: Phaser.GameObjects.Graphics;
  trailGfx!: Phaser.GameObjects.Graphics;
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
  botAlive = new Map<Bot, boolean>();
  trail: Trail[] = [];
  rocketSmoke: RocketSmokeFx[] = [];
  rocketSmokeTimers = new Map<Projectile, number>();
  explosions: ExplosionFx[] = [];
  spawnPadParticles: SpawnPadParticle[] = [];
  spawnPadParticleTimer = 0;
  trailTimer = 0;
  lastState = "alive";
  debugVisible = window.innerWidth > 620;

  preload() {
    this.load.spritesheet("arenaTiles", "/assets/arena-tileset.png", {
      frameWidth: 313,
      frameHeight: 313,
    });
    this.load.spritesheet("rocketProjectile", "/assets/rocket-projectile.png?v=2", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("rocketSmoke", "/assets/rocket-smoke.png?v=1", {
      frameWidth: 180,
      frameHeight: 180,
    });
    this.load.spritesheet("rocketExplosion", "/assets/rocket-explosion.png?v=2", {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.image("uiRocketButton", "/assets/ui-rocket-button.png");
    this.load.image("uiAmmoBadge", "/assets/ui-ammo-badge.png");
    this.load.image("pickupHealth", "/assets/pickup-health.png");
    this.load.image("pickupArmor", "/assets/pickup-armor.png");
    this.load.image("pickupRocket", "/assets/pickup-rocket.png");
    this.load.image("flagRed", "/assets/flag-red.png");
    this.load.image("flagBlue", "/assets/flag-blue.png");
    this.load.image("spawnPad", "/assets/spawn-pad.png");
  }

  create(data?: { mapId?: LevelId; redCount?: number; blueCount?: number }) {
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

    this.drawArena();
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

  update(_t: number, delta: number) {
    const ms = Math.min(delta, 34), dt = ms / 1000;
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
    for (const p of this.projectiles) p.update(dt, ms, [...this.bots, this.player], this.level.walls);
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
    this.updateSpawnPadParticles(ms);
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
    this.renderTrail();
    this.gfx.clear();
    this.renderExplosions();
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
    if (actor.rocketAmmo <= 0) return;
    this.pickups.dropRocketAmmo(actor.x, actor.y, actor.rocketAmmo);
    actor.rocketAmmo = 0;
  }

  createPickupView(pickup: Pickup) {
    const container = this.add.container(pickup.x, pickup.y).setDepth(18);
    const iconKey = pickup.kind === "health" ? "pickupHealth" : pickup.kind === "armor" ? "pickupArmor" : "pickupRocket";
    const icon = this.add.image(0, pickup.kind === "rocket" ? -3 : -5, iconKey).setName("icon").setScale(pickup.temporary ? .17 : .18).setDepth(1);
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

  renderRocketAim() {
    if (!this.rocketBtn.held || !this.rocketBtn.dragged || this.player.rocketAmmo <= 0 || this.player.state !== "alive") return;
    const alpha = this.rocketBtn.drag < 18 ? .22 : .78;
    const h = this.player.jump.height;
    const sx = this.player.x, sy = this.player.y - h;
    const ex = sx + this.rocketBtn.aimX * 260, ey = sy + this.rocketBtn.aimY * 260;
    this.gfx.lineStyle(4, 0xffd36c, alpha).beginPath().moveTo(sx, sy).lineTo(ex, ey).strokePath();
    this.gfx.fillStyle(0xfff0b2, alpha).fillCircle(ex, ey, 7);
  }

  drawArena() {
    const g = this.add.graphics().setDepth(0);
    this.drawFloorTiles();
    this.drawObjectSprite(this.level.redBase, 2, .92);
    this.drawObjectSprite(this.level.blueBase, 3, .92);
    for (const gap of this.level.gaps) this.drawObjectSprite(gap, 8, 1);
    for (const wall of this.level.walls) this.drawObjectSprite(wall, wall.w > wall.h ? 4 : 5, 1);

    g.lineStyle(1, 0xcadbd4, .28);
    for (let x = 0; x <= T.worldWidth; x += 50) g.beginPath().moveTo(x, 0).lineTo(x, T.worldHeight).strokePath();
    for (let y = 0; y <= T.worldHeight; y += 50) g.beginPath().moveTo(0, y).lineTo(T.worldWidth, y).strokePath();
    this.zone(g, this.level.redBase, TEAM.red.base, TEAM.red.dark); this.zone(g, this.level.blueBase, TEAM.blue.base, TEAM.blue.dark);
    g.lineStyle(3, 0x9dafaa, .45).beginPath().moveTo(T.worldWidth / 2, 40).lineTo(T.worldWidth / 2, T.worldHeight - 40).strokePath();
  }
  drawFloorTiles() {
    const size = 50;
    for (let y = 0; y < T.worldHeight; y += size) {
      for (let x = 0; x < T.worldWidth; x += size) {
        const frame = (Math.floor(x / size) + Math.floor(y / size) * 2) % 7 === 0 ? 1 : 0;
        this.add.image(x + size / 2, y + size / 2, "arenaTiles", frame).setDisplaySize(size, size).setDepth(-2);
      }
    }
  }
  drawObjectSprite(r: Rect, frame: number, alpha = 1) {
    this.add.image(r.x + r.w / 2, r.y + r.h / 2, "arenaTiles", frame).setDisplaySize(r.w, r.h).setAlpha(alpha).setDepth(-1);
  }
  zone(g: Phaser.GameObjects.Graphics, r: Rect, fill: number, stroke: number) { g.fillStyle(fill, .18).fillRoundedRect(r.x, r.y, r.w, r.h, 8).lineStyle(3, stroke, .62).strokeRoundedRect(r.x, r.y, r.w, r.h, 8); }

  layoutTouch() {
    this.joy.ox = Math.max(96, this.scale.width * .12);
    this.joy.oy = this.scale.height - 96;
    this.jumpBtn.x = this.scale.width - Math.max(84, this.scale.width * .09);
    this.jumpBtn.y = this.scale.height - 94;
    this.rocketBtn.x = this.jumpBtn.x - 96;
    this.rocketBtn.y = this.jumpBtn.y + 10;
  }
  pointerDown(p: Phaser.Input.Pointer) {
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
  updateHud() {
    document.querySelector("#red-score")!.textContent = String(this.flags.redScore);
    document.querySelector("#blue-score")!.textContent = String(this.flags.blueScore);
    document.querySelector("#flag-state")!.textContent = this.flags.text(this.player);
    document.querySelector("#player-hp")!.textContent = `${Math.max(0, Math.ceil(this.player.hp))}/${T.playerMaxHp}`;
    document.querySelector("#player-armor")!.textContent = String(Math.max(0, Math.ceil(this.player.armor)));
    document.querySelector("#weapon")!.textContent = this.player.rocketAmmo > 0 ? `Rocket x${this.player.rocketAmmo}` : "Auto";
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
weapon: ${this.player.rocketAmmo > 0 ? `rocket ${this.player.rocketAmmo}` : "auto"}
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
