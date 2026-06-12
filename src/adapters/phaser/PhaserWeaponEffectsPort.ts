import Phaser from "phaser";
import type { EffectsPort } from "../effects";
import type { GameEvent, WorldSnapshot } from "../../core";

export class PhaserWeaponEffectsPort implements EffectsPort {
  private readonly active: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === "weapon.railFired") {
        this.addRail(readPoint(event.payload, "start"), readPoint(event.payload, "end"));
      } else if (event.type === "weapon.whipFired") {
        this.addWhip(
          readPoint(event.payload, "origin"),
          readPoint(event.payload, "direction"),
          readNumber(event.payload, "range"),
          readNumber(event.payload, "halfAngle"),
        );
      } else if (event.type === "weapon.rocketExploded") {
        this.addExplosion(
          readPoint(event.payload, "position"),
          readNumber(event.payload, "splashRadius"),
        );
      }
    }
  }

  update(_deltaMs: number, _snapshot: WorldSnapshot): void {}

  reset(): void {
    this.destroyActive();
  }

  dispose(): void {
    this.destroyActive();
  }

  private addRail(start: Point | null, end: Point | null): void {
    if (!start || !end) return;
    const graphics = this.scene.add.graphics().setDepth(70);
    graphics.lineStyle(6, 0x163d25, .55).lineBetween(start.x, start.y, end.x, end.y);
    graphics.lineStyle(3, 0x79ff9f, 1).lineBetween(start.x, start.y, end.x, end.y);
    const impact = this.scene.add.image(end.x, end.y, "railImpact")
      .setScale(.18).setDepth(71);
    this.active.push(graphics, impact);
    this.fadeAndDestroy([graphics, impact], 190);
  }

  private addWhip(
    origin: Point | null,
    direction: Point | null,
    range: number,
    halfAngle: number,
  ): void {
    if (!origin || !direction || range <= 0) return;
    const graphics = this.scene.add.graphics().setDepth(69);
    const angle = Math.atan2(direction.y, direction.x);
    graphics.lineStyle(9, 0x472b51, .38)
      .beginPath()
      .arc(origin.x, origin.y, range, angle - halfAngle, angle + halfAngle)
      .strokePath();
    graphics.lineStyle(4, 0xf2b35e, .95)
      .beginPath()
      .arc(origin.x, origin.y, range, angle - halfAngle, angle + halfAngle)
      .strokePath();
    this.active.push(graphics);
    this.fadeAndDestroy([graphics], 180);
  }

  private addExplosion(position: Point | null, radius: number): void {
    if (!position || radius <= 0) return;
    const graphics = this.scene.add.graphics().setDepth(72);
    graphics.fillStyle(0xff9f3d, .28).fillCircle(position.x, position.y, radius);
    graphics.lineStyle(5, 0xffd36c, .9)
      .strokeCircle(position.x, position.y, radius);
    const sprite = this.scene.add.image(
      position.x,
      position.y,
      "rocketExplosion",
      0,
    ).setScale(.45).setDepth(73);
    this.active.push(graphics, sprite);
    this.fadeAndDestroy([graphics, sprite], 240);
  }

  private fadeAndDestroy(
    targets: Phaser.GameObjects.GameObject[],
    duration: number,
  ): void {
    this.scene.tweens.add({
      targets,
      alpha: 0,
      duration,
      onComplete: () => {
        for (const target of targets) {
          target.destroy();
          const index = this.active.indexOf(target);
          if (index >= 0) this.active.splice(index, 1);
        }
      },
    });
  }

  private destroyActive(): void {
    for (const target of this.active) target.destroy();
    this.active.length = 0;
  }
}

interface Point {
  readonly x: number;
  readonly y: number;
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
