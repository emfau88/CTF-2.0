import Phaser from "phaser";
import type {
  ActorId,
  ActorState,
  ProjectileId,
  ProjectileState,
  PickupId,
  PickupState,
  WorldSnapshot,
} from "../../core";
import type { RendererPort } from "../rendering";

interface DiagnosticActorView {
  readonly shadow: Phaser.GameObjects.Arc;
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Arc;
  readonly facing: Phaser.GameObjects.Line;
  readonly label: Phaser.GameObjects.Text;
}

export class PhaserDiagnosticRendererPort implements RendererPort {
  private readonly actorViews = new Map<ActorId, DiagnosticActorView>();
  private readonly projectileViews =
    new Map<ProjectileId, Phaser.GameObjects.Arc>();
  private readonly pickupViews =
    new Map<PickupId, Phaser.GameObjects.Container>();
  private readonly geometryGraphics: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.geometryGraphics = scene.add.graphics().setDepth(-10);
  }

  render(snapshot: WorldSnapshot): void {
    this.renderGeometry(snapshot);
    this.updateCamera(snapshot);
    const visibleActorIds = new Set(snapshot.actors.map((actor) => actor.id));

    for (const [actorId, view] of this.actorViews) {
      if (!visibleActorIds.has(actorId)) {
        view.shadow.destroy();
        view.container.destroy();
        this.actorViews.delete(actorId);
      }
    }

    for (const actor of snapshot.actors) {
      this.renderActor(actor);
    }
    this.renderProjectiles(snapshot);
    this.renderPickups(snapshot);
  }

  reset(): void {
    this.geometryGraphics.clear();
    this.destroyActorViews();
    this.destroyProjectileViews();
    this.destroyPickupViews();
  }

  dispose(): void {
    this.geometryGraphics.destroy();
    this.destroyActorViews();
    this.destroyProjectileViews();
    this.destroyPickupViews();
  }

  private renderActor(actor: Readonly<ActorState>): void {
    const view = this.actorViews.get(actor.id) ?? this.createActorView(actor);
    const radius = Math.max(8, actor.radius);

    view.shadow.setPosition(actor.position.x, actor.position.y);
    view.shadow.setScale(1 + actor.jump.height / 310, .45);
    view.shadow.setAlpha(.18 + actor.jump.height / 620);
    view.container.setPosition(
      actor.position.x,
      actor.position.y - actor.jump.height,
    );
    view.container.setScale(1 + actor.jump.height / 210);
    view.container.setAlpha(actor.lifeState === "active" ? 1 : .4);
    view.body.setRadius(radius);
    view.facing.setTo(
      0,
      0,
      actor.facing.x * radius * 1.5,
      actor.facing.y * radius * 1.5,
    );
    view.label.setPosition(0, radius + 10);
    view.label.setText([
      `${actor.id} [${actor.teamId ?? "neutral"}] life ${actor.lifeId}`,
      `HP ${actor.health}/${actor.maxHealth}  AR ${actor.armor}/${actor.maxArmor}`,
    ]);
  }

  private createActorView(actor: Readonly<ActorState>): DiagnosticActorView {
    const shadow = this.scene.add.circle(
      actor.position.x,
      actor.position.y,
      actor.radius,
      0x17302d,
      .18,
    ).setScale(1, .45);
    const bodyColor = actor.kind === "diagnostic-target"
      ? 0xb56f55
      : 0x3a8f88;
    const body = this.scene.add.circle(0, 0, actor.radius, bodyColor)
      .setStrokeStyle(3, 0x17302d);
    const facing = this.scene.add.line(0, 0, 0, 0, 1, 0, 0x17302d)
      .setOrigin(0)
      .setLineWidth(4);
    const label = this.scene.add.text(0, actor.radius + 10, actor.id, {
      fontFamily: "Consolas, monospace",
      fontSize: "14px",
      color: "#17302d",
      align: "center",
    }).setOrigin(.5, 0);
    const container = this.scene.add.container(
      actor.position.x,
      actor.position.y,
      [body, facing, label],
    );
    const view = { shadow, container, body, facing, label };

    this.actorViews.set(actor.id, view);
    return view;
  }

  private destroyActorViews(): void {
    for (const view of this.actorViews.values()) {
      view.shadow.destroy();
      view.container.destroy();
    }
    this.actorViews.clear();
  }

  private renderProjectiles(snapshot: WorldSnapshot): void {
    const visibleIds = new Set(
      snapshot.projectiles.map((projectile) => projectile.id),
    );
    for (const [projectileId, view] of this.projectileViews) {
      if (!visibleIds.has(projectileId)) {
        view.destroy();
        this.projectileViews.delete(projectileId);
      }
    }
    for (const projectile of snapshot.projectiles) {
      this.renderProjectile(projectile);
    }
  }

  private renderProjectile(projectile: Readonly<ProjectileState>): void {
    const view = this.projectileViews.get(projectile.id) ??
      this.scene.add.circle(
        projectile.position.x,
        projectile.position.y,
        projectile.radius,
        0xf3c453,
        1,
      ).setStrokeStyle(2, 0x5d3b00).setDepth(20);
    view.setPosition(projectile.position.x, projectile.position.y);
    this.projectileViews.set(projectile.id, view);
  }

  private destroyProjectileViews(): void {
    for (const view of this.projectileViews.values()) {
      view.destroy();
    }
    this.projectileViews.clear();
  }

  private renderPickups(snapshot: WorldSnapshot): void {
    const activePickups = snapshot.pickups.filter((pickup) =>
      pickup.lifeState === "active"
    );
    const visibleIds = new Set(activePickups.map((pickup) => pickup.id));
    for (const [pickupId, view] of this.pickupViews) {
      if (!visibleIds.has(pickupId)) {
        view.destroy();
        this.pickupViews.delete(pickupId);
      }
    }
    for (const pickup of activePickups) {
      this.renderPickup(pickup);
    }
  }

  private renderPickup(pickup: Readonly<PickupState>): void {
    const view = this.pickupViews.get(pickup.id) ??
      this.createPickupView(pickup);
    view.setPosition(pickup.position.x, pickup.position.y);
  }

  private createPickupView(
    pickup: Readonly<PickupState>,
  ): Phaser.GameObjects.Container {
    const color = pickup.type === "health" ? 0x48a868 : 0x4e78c4;
    const body = this.scene.add.circle(0, 0, pickup.radius, color, .9)
      .setStrokeStyle(3, 0x17302d);
    const symbol = this.scene.add.text(
      0,
      0,
      pickup.type === "health" ? "+" : "A",
      {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      },
    ).setOrigin(.5);
    const label = this.scene.add.text(0, pickup.radius + 5, pickup.type, {
      fontFamily: "Consolas, monospace",
      fontSize: "12px",
      color: "#17302d",
    }).setOrigin(.5, 0);
    const view = this.scene.add.container(
      pickup.position.x,
      pickup.position.y,
      [body, symbol, label],
    ).setDepth(10);
    this.pickupViews.set(pickup.id, view);
    return view;
  }

  private destroyPickupViews(): void {
    for (const view of this.pickupViews.values()) {
      view.destroy();
    }
    this.pickupViews.clear();
  }

  private renderGeometry(snapshot: WorldSnapshot): void {
    const graphics = this.geometryGraphics;
    const bounds = snapshot.geometry.bounds;
    graphics.clear();
    graphics.lineStyle(2, 0x52706c, .8);
    graphics.strokeRect(
      bounds.minX,
      bounds.minY,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
    );

    graphics.fillStyle(0x6b7775, .75);
    graphics.lineStyle(2, 0x253b38, 1);
    for (const solid of snapshot.geometry.solids) {
      graphics.fillRect(solid.x, solid.y, solid.width, solid.height);
      graphics.strokeRect(solid.x, solid.y, solid.width, solid.height);
    }

    graphics.fillStyle(0x6a2f45, .72);
    graphics.lineStyle(2, 0x321420, 1);
    for (const gap of snapshot.geometry.gaps) {
      graphics.fillRect(gap.x, gap.y, gap.width, gap.height);
      graphics.strokeRect(gap.x, gap.y, gap.width, gap.height);
    }
  }

  private updateCamera(snapshot: WorldSnapshot): void {
    const bounds = snapshot.geometry.bounds;
    const camera = this.scene.cameras.main;
    camera.setBounds(
      bounds.minX,
      bounds.minY,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
    );
    const actor = snapshot.actors[0];
    if (actor) {
      camera.centerOn(actor.position.x, actor.position.y);
    }
  }
}
