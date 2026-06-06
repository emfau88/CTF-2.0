import Phaser from "phaser";
import { T, TEAM, type TeamId } from "./config";
import { len, type Vec2 } from "./math";
import type { Player } from "./player";
import type { Pickup, Projectile } from "./systems";

type Trail = { x: number; y: number; life: number; max: number; air: boolean; speed: number };
type RocketSmokeFx = {
  x: number;
  y: number;
  life: number;
  max: number;
  frame: number;
  scale: number;
  rotation: number;
  view?: Phaser.GameObjects.Image;
};
type ExplosionFx = { x: number; y: number; life: number; max: number; view?: Phaser.GameObjects.Image };
type SpawnPadParticle = { x: number; y: number; ox: number; life: number; max: number; size: number };
type DeathParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
};
type DeathRing = { x: number; y: number; life: number; max: number; color: number; delay: number };
type DeathFlash = { x: number; y: number; life: number; max: number; color: number };
type RailBeamFx = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  max: number;
  hit: boolean;
  impact?: Phaser.GameObjects.Image;
};
type WhipSwingFx = { x: number; y: number; angle: number; life: number; max: number; hit: boolean };

export class ArenaEffects {
  private readonly trailGfx: Phaser.GameObjects.Graphics;
  private trail: Trail[] = [];
  private trailTimer = 0;
  private rocketSmoke: RocketSmokeFx[] = [];
  private rocketSmokeTimers = new Map<Projectile, number>();
  private explosions: ExplosionFx[] = [];
  private railBeams: RailBeamFx[] = [];
  private whipSwings: WhipSwingFx[] = [];
  private spawnPadParticles: SpawnPadParticle[] = [];
  private spawnPadParticleTimer = 0;
  private deathParticles: DeathParticle[] = [];
  private deathRings: DeathRing[] = [];
  private deathFlashes: DeathFlash[] = [];

  constructor(private scene: Phaser.Scene) {
    this.trailGfx = scene.add.graphics().setDepth(15);
  }

  update(ms: number, player: Player, projectiles: Projectile[], pickups: Pickup[]) {
    this.updateTrail(ms, player);
    this.emitRocketSmoke(ms, projectiles);
    this.updateRocketSmoke(ms);
    this.updateExplosions(ms);
    this.updateRailBeams(ms);
    this.updateWhipSwings(ms);
    this.updateSpawnPadParticles(ms, pickups);
    this.updateDeathBursts(ms);
  }

  projectileRemoved(projectile: Projectile) {
    if (projectile.exploded) {
      this.explosions.push({ x: projectile.x, y: projectile.y, life: 420, max: 420 });
    }
    this.rocketSmokeTimers.delete(projectile);
  }

  addRailBeam(start: Vec2, end: Vec2, hit: boolean) {
    this.railBeams.push({
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      life: T.railBeamLifeMs,
      max: T.railBeamLifeMs,
      hit,
    });
  }

  addWhipSwing(x: number, y: number, direction: Vec2, hit: boolean) {
    this.whipSwings.push({
      x,
      y,
      angle: Math.atan2(direction.y, direction.x),
      life: 210,
      max: 210,
      hit,
    });
  }

  addDeathBurst(x: number, y: number, team: TeamId) {
    const colors = [TEAM[team].color, TEAM[team].dark, TEAM[team].color, 0xffffff];
    for (let index = 0; index < 24; index++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(110, 285);
      const life = Phaser.Math.Between(360, 650);
      this.deathParticles.push({
        x: x + Phaser.Math.Between(-4, 4),
        y: y + Phaser.Math.Between(-4, 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        max: life,
        size: Phaser.Math.FloatBetween(3.5, 8.5),
        color: colors[index % colors.length],
      });
    }
    this.deathRings.push(
      { x, y, life: 440, max: 440, color: 0xffffff, delay: 0 },
      { x, y, life: 520, max: 520, color: TEAM[team].color, delay: 70 },
    );
    this.deathFlashes.push({ x, y, life: 180, max: 180, color: TEAM[team].color });
  }

  renderBeforeActors(gfx: Phaser.GameObjects.Graphics, now: number) {
    this.renderTrail();
    this.renderExplosions(gfx);
    this.renderRailBeams(gfx, now);
    this.renderWhipSwings(gfx);
    this.renderDeathBursts(gfx);
  }

  renderRocketSmoke() {
    for (const fx of this.rocketSmoke) {
      const t = 1 - fx.life / fx.max;
      const alpha = Math.max(0, fx.life / fx.max) * .72;
      if (!fx.view) {
        fx.view = this.scene.add.image(fx.x, fx.y, "rocketSmoke", fx.frame)
          .setDepth(49)
          .setBlendMode(Phaser.BlendModes.NORMAL);
      }
      fx.view
        .setPosition(fx.x, fx.y)
        .setRotation(fx.rotation)
        .setScale(fx.scale * (1 + t * .75))
        .setAlpha(alpha);
    }
  }

  renderSpawnPadParticles(gfx: Phaser.GameObjects.Graphics) {
    for (const particle of this.spawnPadParticles) {
      const t = 1 - particle.life / particle.max;
      const alpha = Phaser.Math.Clamp(particle.life / particle.max, 0, 1) * .45;
      gfx.fillStyle(0x7dfcff, alpha).fillCircle(
        particle.x + particle.ox * t,
        particle.y - t * 34,
        particle.size * (1 - t * .35),
      );
    }
  }

  private updateTrail(ms: number, player: Player) {
    this.trailTimer -= ms;
    const speedRatio = Math.min(1, player.speed() / T.maxSpeed);
    if (player.state === "alive" && this.trailTimer <= 0 && player.speed() > 48) {
      this.trailTimer = Math.max(7, T.trailIntervalMs - speedRatio * 8);
      this.trail.push({
        x: player.x,
        y: player.y,
        life: T.trailLifeMs,
        max: T.trailLifeMs,
        air: player.jump.active,
        speed: speedRatio,
      });
      if (this.trail.length > T.trailMax) this.trail.shift();
    }
    this.trail.forEach((item) => item.life -= ms);
    this.trail = this.trail.filter((item) => item.life > 0);
  }

  private renderTrail() {
    this.trailGfx.clear();
    for (const item of this.trail) {
      const alpha = item.life / item.max;
      this.trailGfx
        .fillStyle(item.air ? 0x5eb5dc : 0x234f49, alpha * (item.air ? .34 : .22))
        .fillCircle(item.x, item.y, (5 + item.speed * 9) * alpha);
    }
  }

  private emitRocketSmoke(ms: number, projectiles: Projectile[]) {
    for (const projectile of projectiles) {
      if (projectile.kind !== "rocket" || projectile.dead) continue;
      const next = (this.rocketSmokeTimers.get(projectile) ?? 0) - ms;
      if (next > 0) {
        this.rocketSmokeTimers.set(projectile, next);
        continue;
      }
      const speed = len(projectile.vx, projectile.vy) || 1;
      const nx = projectile.vx / speed, ny = projectile.vy / speed;
      this.rocketSmoke.push({
        x: projectile.x - nx * 20 + Phaser.Math.Between(-4, 4),
        y: projectile.y - ny * 20 + Phaser.Math.Between(-4, 4),
        life: 320,
        max: 320,
        frame: Phaser.Math.Between(0, 5),
        scale: Phaser.Math.FloatBetween(.16, .24),
        rotation: Phaser.Math.FloatBetween(-.45, .45),
      });
      this.rocketSmokeTimers.set(projectile, 42);
    }
  }

  private updateRocketSmoke(ms: number) {
    for (const fx of this.rocketSmoke) fx.life -= ms;
    for (const fx of this.rocketSmoke.filter((item) => item.life <= 0)) fx.view?.destroy();
    this.rocketSmoke = this.rocketSmoke.filter((fx) => fx.life > 0);
  }

  private updateExplosions(ms: number) {
    this.explosions.forEach((fx) => fx.life -= ms);
    for (const fx of this.explosions.filter((item) => item.life <= 0)) fx.view?.destroy();
    this.explosions = this.explosions.filter((fx) => fx.life > 0);
  }

  private renderExplosions(gfx: Phaser.GameObjects.Graphics) {
    for (const fx of this.explosions) {
      const t = 1 - fx.life / fx.max;
      const alpha = fx.life / fx.max;
      const frame = Phaser.Math.Clamp(Math.floor(t * 6), 0, 5);
      if (!fx.view) {
        fx.view = this.scene.add.image(fx.x, fx.y, "rocketExplosion", 0).setDepth(70).setScale(.38);
      }
      fx.view
        .setFrame(frame)
        .setPosition(fx.x, fx.y)
        .setScale(.30 + t * .16)
        .setAlpha(Math.min(1, alpha * 1.25));
      gfx.fillStyle(0xf59f2f, .08 * alpha)
        .fillCircle(fx.x, fx.y, T.rocketSplashRadius * Math.min(1, t * 1.25));
      gfx.lineStyle(2, 0xffd36c, .3 * alpha)
        .strokeCircle(fx.x, fx.y, T.rocketSplashRadius * Math.min(1, t * 1.1));
    }
  }

  private updateRailBeams(ms: number) {
    for (const beam of this.railBeams) beam.life -= ms;
    for (const beam of this.railBeams.filter((item) => item.life <= 0)) beam.impact?.destroy();
    this.railBeams = this.railBeams.filter((beam) => beam.life > 0);
  }

  private updateWhipSwings(ms: number) {
    for (const swing of this.whipSwings) swing.life -= ms;
    this.whipSwings = this.whipSwings.filter((swing) => swing.life > 0);
  }

  private renderRailBeams(gfx: Phaser.GameObjects.Graphics, now: number) {
    for (const beam of this.railBeams) {
      const alpha = Phaser.Math.Clamp(beam.life / beam.max, 0, 1);
      gfx.lineStyle(14, 0x34ff79, .08 * alpha).beginPath().moveTo(beam.x1, beam.y1).lineTo(beam.x2, beam.y2).strokePath();
      gfx.lineStyle(7, 0x20e966, .32 * alpha).beginPath().moveTo(beam.x1, beam.y1).lineTo(beam.x2, beam.y2).strokePath();
      gfx.lineStyle(3, 0xbaffd0, .96 * alpha).beginPath().moveTo(beam.x1, beam.y1).lineTo(beam.x2, beam.y2).strokePath();
      gfx.fillStyle(0xe6ffed, .9 * alpha).fillCircle(beam.x1, beam.y1, 4);
      if (beam.hit) {
        if (!beam.impact) {
          beam.impact = this.scene.add.image(beam.x2, beam.y2, "railImpact").setDepth(56).setScale(.18);
        }
        beam.impact
          .setPosition(beam.x2, beam.y2)
          .setRotation(now * .018)
          .setScale(.13 + (1 - alpha) * .1)
          .setAlpha(alpha);
      }
    }
  }

  private renderWhipSwings(gfx: Phaser.GameObjects.Graphics) {
    for (const swing of this.whipSwings) {
      const alpha = Phaser.Math.Clamp(swing.life / swing.max, 0, 1);
      const progress = 1 - alpha;
      const startAngle = swing.angle - T.whipHalfAngle;
      const endAngle = swing.angle + T.whipHalfAngle;
      const radius = T.whipRange * (.72 + progress * .28);
      gfx.lineStyle(13, swing.hit ? 0xffd36c : 0x8d5a3a, .12 * alpha)
        .beginPath().arc(swing.x, swing.y, radius, startAngle, endAngle).strokePath();
      gfx.lineStyle(5, swing.hit ? 0xfff0b2 : 0xe2ad70, .9 * alpha)
        .beginPath().arc(swing.x, swing.y, radius, startAngle, endAngle).strokePath();
    }
  }

  private updateSpawnPadParticles(ms: number, pickups: Pickup[]) {
    this.spawnPadParticleTimer -= ms;
    if (this.spawnPadParticleTimer <= 0) {
      this.spawnPadParticleTimer = 95;
      for (const pickup of pickups) {
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

  private updateDeathBursts(ms: number) {
    const dt = ms / 1000;
    for (const particle of this.deathParticles) {
      particle.life -= ms;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - dt * 5);
      particle.vy *= Math.max(0, 1 - dt * 5);
    }
    this.deathParticles = this.deathParticles.filter((particle) => particle.life > 0);
    for (const ring of this.deathRings) ring.life -= ms;
    this.deathRings = this.deathRings.filter((ring) => ring.life > 0);
    for (const flash of this.deathFlashes) flash.life -= ms;
    this.deathFlashes = this.deathFlashes.filter((flash) => flash.life > 0);
  }

  private renderDeathBursts(gfx: Phaser.GameObjects.Graphics) {
    for (const flash of this.deathFlashes) {
      const alpha = Phaser.Math.Clamp(flash.life / flash.max, 0, 1);
      const progress = 1 - alpha;
      gfx.fillStyle(0xffffff, alpha * .9).fillCircle(flash.x, flash.y, 13 + progress * 10);
      gfx.fillStyle(flash.color, alpha * .55).fillCircle(flash.x, flash.y, 25 + progress * 18);
    }
    for (const ring of this.deathRings) {
      const elapsed = ring.max - ring.life;
      if (elapsed < ring.delay) continue;
      const progress = Phaser.Math.Clamp((elapsed - ring.delay) / (ring.max - ring.delay), 0, 1);
      const alpha = 1 - progress;
      gfx.lineStyle(6 - progress * 3, ring.color, alpha * .9)
        .strokeCircle(ring.x, ring.y, 12 + progress * 52);
    }
    for (const particle of this.deathParticles) {
      const alpha = Phaser.Math.Clamp(particle.life / particle.max, 0, 1);
      gfx.fillStyle(particle.color, alpha)
        .fillCircle(particle.x, particle.y, particle.size * (.45 + alpha * .55));
    }
  }
}
