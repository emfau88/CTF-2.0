import Phaser from "phaser";
import { V2_GROUND_PARITY_CONFIG } from "../../core";
import type {
  ActorState,
  GameEvent,
  ProjectileState,
  WorldSnapshot,
} from "../../core";
import type { EffectsPort } from "../effects";

const TEAM_COLORS: Record<string, { color: number; dark: number }> = {
  red: { color: 0xe45151, dark: 0xb7272d },
  blue: { color: 0x3777e6, dark: 0x255ec8 },
};

interface Point {
  readonly x: number;
  readonly y: number;
}

interface TrailParticle extends Point {
  lifeMs: number;
  readonly maxLifeMs: number;
  readonly airborne: boolean;
  readonly speedRatio: number;
}

interface RocketSmokeParticle extends Point {
  lifeMs: number;
  readonly maxLifeMs: number;
  readonly frame: number;
  readonly scale: number;
  readonly rotation: number;
  readonly view: Phaser.GameObjects.Image;
}

interface ExplosionEffect extends Point {
  lifeMs: number;
  readonly maxLifeMs: number;
  readonly splashRadius: number;
  readonly view: Phaser.GameObjects.Image;
}

interface RailEffect {
  readonly start: Point;
  readonly end: Point;
  readonly hit: boolean;
  lifeMs: number;
  readonly maxLifeMs: number;
  readonly impact?: Phaser.GameObjects.Image;
}

interface WhipEffect extends Point {
  readonly direction: Point;
  readonly range: number;
  readonly halfAngle: number;
  readonly hit: boolean;
  lifeMs: number;
  readonly maxLifeMs: number;
}

interface DeathParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  readonly maxLifeMs: number;
  readonly size: number;
  readonly color: number;
}

interface DeathRing extends Point {
  lifeMs: number;
  readonly maxLifeMs: number;
  readonly color: number;
  readonly delayMs: number;
}

interface DeathFlash extends Point {
  lifeMs: number;
  readonly maxLifeMs: number;
  readonly color: number;
}

export class PhaserWeaponEffectsPort implements EffectsPort {
  private readonly trailGraphics: Phaser.GameObjects.Graphics;
  private readonly effectsGraphics: Phaser.GameObjects.Graphics;
  private readonly rocketSmokeTimers = new Map<string, number>();
  private trailTimerMs = 0;
  private trail: TrailParticle[] = [];
  private rocketSmoke: RocketSmokeParticle[] = [];
  private explosions: ExplosionEffect[] = [];
  private railEffects: RailEffect[] = [];
  private whipEffects: WhipEffect[] = [];
  private deathParticles: DeathParticle[] = [];
  private deathRings: DeathRing[] = [];
  private deathFlashes: DeathFlash[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly controlledActorId = "blue-player",
  ) {
    this.trailGraphics = scene.add.graphics().setDepth(15);
    this.effectsGraphics = scene.add.graphics().setDepth(69);
  }

  handleEvents(
    events: readonly GameEvent[],
    snapshot: WorldSnapshot,
  ): void {
    for (const event of events) {
      if (event.type === "actor.died") {
        const actor = event.targetActorId
          ? snapshot.actors.find((candidate) =>
            candidate.id === event.targetActorId
          )
          : undefined;
        if (actor) this.addDeathBurst(actor, event.teamId);
      } else if (event.type === "weapon.railFired") {
        this.addRail(
          readPoint(event.payload, "start"),
          readPoint(event.payload, "end"),
          readBoolean(event.payload, "hit"),
        );
      } else if (event.type === "weapon.whipFired") {
        this.addWhip(
          readPoint(event.payload, "origin"),
          readPoint(event.payload, "direction"),
          readNumber(event.payload, "range"),
          readNumber(event.payload, "halfAngle"),
          readBoolean(event.payload, "hit"),
        );
      } else if (event.type === "weapon.rocketExploded") {
        this.addExplosion(
          readPoint(event.payload, "position"),
          readNumber(event.payload, "splashRadius"),
        );
      }
    }
  }

  update(deltaMs: number, snapshot: WorldSnapshot): void {
    const ms = Math.min(100, Math.max(0, deltaMs));
    this.updateTrail(ms, snapshot);
    this.updateRocketSmoke(ms, snapshot.projectiles);
    this.updateTimedEffects(ms);
    this.updateDeathBursts(ms);
    this.render(snapshot.timeMs);
  }

  reset(): void {
    this.trailTimerMs = 0;
    this.trail = [];
    this.rocketSmokeTimers.clear();
    for (const particle of this.rocketSmoke) particle.view.destroy();
    for (const effect of this.explosions) effect.view.destroy();
    for (const effect of this.railEffects) effect.impact?.destroy();
    this.rocketSmoke = [];
    this.explosions = [];
    this.railEffects = [];
    this.whipEffects = [];
    this.deathParticles = [];
    this.deathRings = [];
    this.deathFlashes = [];
    this.trailGraphics.clear();
    this.effectsGraphics.clear();
  }

  dispose(): void {
    this.reset();
    this.trailGraphics.destroy();
    this.effectsGraphics.destroy();
  }

  private updateTrail(ms: number, snapshot: WorldSnapshot): void {
    this.trailTimerMs -= ms;
    const actor = snapshot.actors.find((candidate) =>
      candidate.id === this.controlledActorId
    );
    if (actor) {
      const speedRatio = Math.min(
        1,
        Math.hypot(actor.velocity.x, actor.velocity.y) /
          V2_GROUND_PARITY_CONFIG.maxSpeed,
      );
      if (
        actor.lifeState === "active" &&
        this.trailTimerMs <= 0 &&
        speedRatio * V2_GROUND_PARITY_CONFIG.maxSpeed > 48
      ) {
        this.trailTimerMs = Math.max(7, 18 - speedRatio * 8);
        this.trail.push({
          x: actor.position.x,
          y: actor.position.y,
          lifeMs: 280,
          maxLifeMs: 280,
          airborne: actor.jump.active,
          speedRatio,
        });
        if (this.trail.length > 28) this.trail.shift();
      }
    }
    for (const particle of this.trail) particle.lifeMs -= ms;
    this.trail = this.trail.filter((particle) => particle.lifeMs > 0);
  }

  private updateRocketSmoke(
    ms: number,
    projectiles: readonly Readonly<ProjectileState>[],
  ): void {
    const activeRocketIds = new Set<string>();
    for (const projectile of projectiles) {
      if (projectile.weaponId !== "rocket") continue;
      activeRocketIds.add(projectile.id);
      const next = (this.rocketSmokeTimers.get(projectile.id) ?? 0) - ms;
      if (next > 0) {
        this.rocketSmokeTimers.set(projectile.id, next);
        continue;
      }
      const speed = Math.hypot(
        projectile.velocity.x,
        projectile.velocity.y,
      ) || 1;
      const nx = projectile.velocity.x / speed;
      const ny = projectile.velocity.y / speed;
      const x = projectile.position.x - nx * 20 + Phaser.Math.Between(-4, 4);
      const y = projectile.position.y - ny * 20 + Phaser.Math.Between(-4, 4);
      const frame = Phaser.Math.Between(0, 5);
      const view = this.scene.add.image(
        x,
        y,
        "rocketSmoke",
        frame,
      ).setDepth(49).setBlendMode(Phaser.BlendModes.NORMAL);
      this.rocketSmoke.push({
        x,
        y,
        lifeMs: 320,
        maxLifeMs: 320,
        frame,
        scale: Phaser.Math.FloatBetween(.16, .24),
        rotation: Phaser.Math.FloatBetween(-.45, .45),
        view,
      });
      this.rocketSmokeTimers.set(projectile.id, 42);
    }
    for (const projectileId of this.rocketSmokeTimers.keys()) {
      if (!activeRocketIds.has(projectileId)) {
        this.rocketSmokeTimers.delete(projectileId);
      }
    }
    for (const particle of this.rocketSmoke) particle.lifeMs -= ms;
    for (const particle of this.rocketSmoke.filter((item) =>
      item.lifeMs <= 0
    )) {
      particle.view.destroy();
    }
    this.rocketSmoke = this.rocketSmoke.filter((particle) =>
      particle.lifeMs > 0
    );
  }

  private updateTimedEffects(ms: number): void {
    for (const effect of this.explosions) effect.lifeMs -= ms;
    for (const effect of this.explosions.filter((item) => item.lifeMs <= 0)) {
      effect.view.destroy();
    }
    this.explosions = this.explosions.filter((effect) => effect.lifeMs > 0);

    for (const effect of this.railEffects) effect.lifeMs -= ms;
    for (const effect of this.railEffects.filter((item) => item.lifeMs <= 0)) {
      effect.impact?.destroy();
    }
    this.railEffects = this.railEffects.filter((effect) => effect.lifeMs > 0);

    for (const effect of this.whipEffects) effect.lifeMs -= ms;
    this.whipEffects = this.whipEffects.filter((effect) => effect.lifeMs > 0);
  }

  private updateDeathBursts(ms: number): void {
    const dt = ms / 1000;
    for (const particle of this.deathParticles) {
      particle.lifeMs -= ms;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - dt * 5);
      particle.vy *= Math.max(0, 1 - dt * 5);
    }
    this.deathParticles = this.deathParticles.filter((particle) =>
      particle.lifeMs > 0
    );
    for (const ring of this.deathRings) ring.lifeMs -= ms;
    this.deathRings = this.deathRings.filter((ring) => ring.lifeMs > 0);
    for (const flash of this.deathFlashes) flash.lifeMs -= ms;
    this.deathFlashes = this.deathFlashes.filter((flash) => flash.lifeMs > 0);
  }

  private render(timeMs: number): void {
    this.renderTrail();
    this.renderRocketSmoke();
    this.effectsGraphics.clear();
    this.renderExplosions();
    this.renderRailEffects(timeMs);
    this.renderWhipEffects();
    this.renderDeathBursts();
  }

  private renderTrail(): void {
    this.trailGraphics.clear();
    for (const particle of this.trail) {
      const alpha = particle.lifeMs / particle.maxLifeMs;
      this.trailGraphics.fillStyle(
        particle.airborne ? 0x5eb5dc : 0x234f49,
        alpha * (particle.airborne ? .34 : .22),
      ).fillCircle(
        particle.x,
        particle.y,
        (5 + particle.speedRatio * 9) * alpha,
      );
    }
  }

  private renderRocketSmoke(): void {
    for (const particle of this.rocketSmoke) {
      const progress = 1 - particle.lifeMs / particle.maxLifeMs;
      particle.view
        .setFrame(particle.frame)
        .setPosition(particle.x, particle.y)
        .setRotation(particle.rotation)
        .setScale(particle.scale * (1 + progress * .75))
        .setAlpha(
          Math.max(0, particle.lifeMs / particle.maxLifeMs) * .72,
        );
    }
  }

  private renderExplosions(): void {
    for (const effect of this.explosions) {
      const progress = 1 - effect.lifeMs / effect.maxLifeMs;
      const alpha = effect.lifeMs / effect.maxLifeMs;
      effect.view
        .setFrame(Phaser.Math.Clamp(Math.floor(progress * 6), 0, 5))
        .setScale(.30 + progress * .16)
        .setAlpha(Math.min(1, alpha * 1.25));
      this.effectsGraphics.fillStyle(0xf59f2f, .08 * alpha)
        .fillCircle(
          effect.x,
          effect.y,
          effect.splashRadius * Math.min(1, progress * 1.25),
        );
      this.effectsGraphics.lineStyle(2, 0xffd36c, .3 * alpha)
        .strokeCircle(
          effect.x,
          effect.y,
          effect.splashRadius * Math.min(1, progress * 1.1),
        );
    }
  }

  private renderRailEffects(timeMs: number): void {
    for (const effect of this.railEffects) {
      const alpha = Phaser.Math.Clamp(
        effect.lifeMs / effect.maxLifeMs,
        0,
        1,
      );
      this.effectsGraphics.lineStyle(14, 0x34ff79, .08 * alpha)
        .lineBetween(
          effect.start.x,
          effect.start.y,
          effect.end.x,
          effect.end.y,
        );
      this.effectsGraphics.lineStyle(7, 0x20e966, .32 * alpha)
        .lineBetween(
          effect.start.x,
          effect.start.y,
          effect.end.x,
          effect.end.y,
        );
      this.effectsGraphics.lineStyle(3, 0xbaffd0, .96 * alpha)
        .lineBetween(
          effect.start.x,
          effect.start.y,
          effect.end.x,
          effect.end.y,
        );
      this.effectsGraphics.fillStyle(0xe6ffed, .9 * alpha)
        .fillCircle(effect.start.x, effect.start.y, 4);
      effect.impact
        ?.setRotation(timeMs * .018)
        .setScale(.13 + (1 - alpha) * .1)
        .setAlpha(alpha);
    }
  }

  private renderWhipEffects(): void {
    for (const effect of this.whipEffects) {
      const alpha = Phaser.Math.Clamp(
        effect.lifeMs / effect.maxLifeMs,
        0,
        1,
      );
      const progress = 1 - alpha;
      const angle = Math.atan2(effect.direction.y, effect.direction.x);
      const startAngle = angle - effect.halfAngle;
      const endAngle = angle + effect.halfAngle;
      const radius = effect.range * (.72 + progress * .28);
      this.effectsGraphics.lineStyle(
        13,
        effect.hit ? 0xffd36c : 0x8d5a3a,
        .12 * alpha,
      ).beginPath().arc(
        effect.x,
        effect.y,
        radius,
        startAngle,
        endAngle,
      ).strokePath();
      this.effectsGraphics.lineStyle(
        5,
        effect.hit ? 0xfff0b2 : 0xe2ad70,
        .9 * alpha,
      ).beginPath().arc(
        effect.x,
        effect.y,
        radius,
        startAngle,
        endAngle,
      ).strokePath();
    }
  }

  private renderDeathBursts(): void {
    for (const flash of this.deathFlashes) {
      const alpha = Phaser.Math.Clamp(flash.lifeMs / flash.maxLifeMs, 0, 1);
      const progress = 1 - alpha;
      this.effectsGraphics.fillStyle(0xffffff, alpha * .9)
        .fillCircle(flash.x, flash.y, 13 + progress * 10);
      this.effectsGraphics.fillStyle(flash.color, alpha * .55)
        .fillCircle(flash.x, flash.y, 25 + progress * 18);
    }
    for (const ring of this.deathRings) {
      const elapsed = ring.maxLifeMs - ring.lifeMs;
      if (elapsed < ring.delayMs) continue;
      const progress = Phaser.Math.Clamp(
        (elapsed - ring.delayMs) / (ring.maxLifeMs - ring.delayMs),
        0,
        1,
      );
      this.effectsGraphics.lineStyle(
        6 - progress * 3,
        ring.color,
        (1 - progress) * .9,
      ).strokeCircle(ring.x, ring.y, 12 + progress * 52);
    }
    for (const particle of this.deathParticles) {
      const alpha = Phaser.Math.Clamp(
        particle.lifeMs / particle.maxLifeMs,
        0,
        1,
      );
      this.effectsGraphics.fillStyle(particle.color, alpha)
        .fillCircle(
          particle.x,
          particle.y,
          particle.size * (.45 + alpha * .55),
        );
    }
  }

  private addRail(
    start: Point | null,
    end: Point | null,
    hit: boolean,
  ): void {
    if (!start || !end) return;
    this.railEffects.push({
      start,
      end,
      hit,
      lifeMs: 190,
      maxLifeMs: 190,
      impact: hit
        ? this.scene.add.image(end.x, end.y, "railImpact")
          .setDepth(56)
          .setScale(.18)
        : undefined,
    });
  }

  private addWhip(
    origin: Point | null,
    direction: Point | null,
    range: number,
    halfAngle: number,
    hit: boolean,
  ): void {
    if (!origin || !direction || range <= 0) return;
    this.whipEffects.push({
      x: origin.x,
      y: origin.y,
      direction,
      range,
      halfAngle,
      hit,
      lifeMs: 210,
      maxLifeMs: 210,
    });
  }

  private addExplosion(position: Point | null, splashRadius: number): void {
    if (!position || splashRadius <= 0) return;
    this.explosions.push({
      x: position.x,
      y: position.y,
      splashRadius,
      lifeMs: 420,
      maxLifeMs: 420,
      view: this.scene.add.image(
        position.x,
        position.y,
        "rocketExplosion",
        0,
      ).setDepth(70).setScale(.38),
    });
  }

  private addDeathBurst(
    actor: Readonly<ActorState>,
    eventTeamId: string | undefined,
  ): void {
    const team = TEAM_COLORS[eventTeamId ?? actor.teamId ?? ""] ?? {
      color: 0xffffff,
      dark: 0x7b8582,
    };
    const x = actor.position.x;
    const y = actor.position.y - actor.jump.height;
    const colors = [team.color, team.dark, team.color, 0xffffff];
    for (let index = 0; index < 24; index++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(110, 285);
      const lifeMs = Phaser.Math.Between(360, 650);
      this.deathParticles.push({
        x: x + Phaser.Math.Between(-4, 4),
        y: y + Phaser.Math.Between(-4, 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifeMs,
        maxLifeMs: lifeMs,
        size: Phaser.Math.FloatBetween(3.5, 8.5),
        color: colors[index % colors.length]!,
      });
    }
    this.deathRings.push(
      {
        x,
        y,
        lifeMs: 440,
        maxLifeMs: 440,
        color: 0xffffff,
        delayMs: 0,
      },
      {
        x,
        y,
        lifeMs: 520,
        maxLifeMs: 520,
        color: team.color,
        delayMs: 70,
      },
    );
    this.deathFlashes.push({
      x,
      y,
      lifeMs: 180,
      maxLifeMs: 180,
      color: team.color,
    });
  }
}

function readPoint(payload: unknown, key: string): Point | null {
  if (!payload || typeof payload !== "object" || !(key in payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  if (!value || typeof value !== "object") return null;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" && typeof point.y === "number"
    ? { x: point.x, y: point.y }
    : null;
}

function readNumber(payload: unknown, key: string): number {
  if (!payload || typeof payload !== "object" || !(key in payload)) return 0;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

function readBoolean(payload: unknown, key: string): boolean {
  return Boolean(
    payload && typeof payload === "object" &&
      key in payload &&
      (payload as Record<string, unknown>)[key],
  );
}
