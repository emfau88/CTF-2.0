import Phaser from "phaser";
import { T } from "./config";
import { len, pointSegmentDistance, type Vec2 } from "./math";
import type { Projectile } from "./systems";

type LibraryDust = {
  x: number;
  y: number;
  speed: number;
  drift: number;
  phase: number;
  size: number;
  alpha: number;
};

type LibraryCandle = {
  x: number;
  y: number;
  lit: boolean;
  flame: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Arc;
  flameTween: Phaser.Tweens.Tween;
  glowTween: Phaser.Tweens.Tween;
};

export class LibraryEffects {
  private gfx?: Phaser.GameObjects.Graphics;
  private dust: LibraryDust[] = [];
  private candles: LibraryCandle[] = [];

  constructor(private scene: Phaser.Scene) {}

  addCandles(x: number, y: number) {
    const points = [{ x: 0, y: -14 }, { x: 7, y: -4 }, { x: -7, y: -4 }];
    for (const [index, point] of points.entries()) {
      const flameX = x + point.x;
      const flameY = y + point.y - 6;
      const glow = this.scene.add.circle(flameX, flameY + 1, 15, 0xffc45a, .13)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(3);
      const flame = this.scene.add.sprite(flameX, flameY, "libraryCandleFlame")
        .setDisplaySize(12, 12)
        .setDepth(4)
        .play({ key: "library-candle-flicker", startFrame: index * 2 });
      const glowTween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: .08, to: .18 },
        duration: 180 + index * 45,
        yoyo: true,
        repeat: -1,
      });
      const flameTween = this.scene.tweens.add({
        targets: flame,
        alpha: { from: index === 1 ? .72 : .88, to: 1 },
        duration: 160 + index * 40,
        yoyo: true,
        repeat: -1,
      });
      this.candles.push({
        x: flameX,
        y: flameY,
        lit: true,
        flame,
        glow,
        flameTween,
        glowTween,
      });
    }
  }

  createAtmosphere() {
    this.gfx = this.scene.add.graphics().setDepth(8);
    this.dust = Array.from({ length: 34 }, (_, index) => ({
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
      const spider = this.scene.add.image(route.x, route.y, "librarySpider")
        .setDisplaySize(18, 18)
        .setFlipX(route.flip)
        .setAlpha(.82)
        .setDepth(3);
      this.scene.tweens.add({
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

  update(dt: number) {
    for (const dust of this.dust) {
      dust.phase += dt * .7;
      dust.y -= dust.speed * dt;
      dust.x += Math.sin(dust.phase) * dust.drift * dt;
      if (dust.y < 55) {
        dust.y = T.worldHeight - 55;
        dust.x = Phaser.Math.Between(270, T.worldWidth - 270);
      }
    }
  }

  render() {
    if (!this.gfx) return;
    this.gfx.clear();
    for (const dust of this.dust) {
      const pulse = .72 + Math.sin(dust.phase * 1.7) * .28;
      this.gfx.fillStyle(0xffe8b0, dust.alpha * pulse).fillCircle(dust.x, dust.y, dust.size);
    }
  }

  handleProjectileImpact(projectile: Projectile) {
    if (!this.candles.length) return;
    const lit = this.candles.filter((candle) => candle.lit);
    if (projectile.kind === "rocket") {
      for (const candle of lit) {
        if (len(candle.x - projectile.x, candle.y - projectile.y) <= T.rocketSplashRadius) this.extinguish(candle);
      }
      return;
    }
    const nearest = lit
      .map((candle) => ({ candle, distance: len(candle.x - projectile.x, candle.y - projectile.y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance <= 54) this.extinguish(nearest.candle);
  }

  extinguishAlongSegment(start: Vec2, end: Vec2) {
    for (const candle of this.candles.filter((item) => item.lit)) {
      if (pointSegmentDistance(candle, start, end) <= 12) this.extinguish(candle);
    }
  }

  private extinguish(candle: LibraryCandle) {
    candle.lit = false;
    candle.flameTween.stop();
    candle.glowTween.stop();
    this.scene.tweens.add({ targets: [candle.flame, candle.glow], alpha: 0, duration: 130 });
  }
}
