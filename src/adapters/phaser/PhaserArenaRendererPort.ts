import Phaser from "phaser";
import type {
  ActorId,
  ActorState,
  PickupId,
  PickupState,
  ProjectileId,
  ProjectileState,
  WorldSnapshot,
} from "../../core";
import { renderArena } from "../../arenaRenderer";
import { LEVEL_BY_ID } from "../../level";
import type { RendererPort } from "../rendering";

interface ArenaActorView {
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly status: Phaser.GameObjects.Graphics;
}

export class PhaserArenaRendererPort implements RendererPort {
  private readonly actorViews = new Map<ActorId, ArenaActorView>();
  private readonly projectileViews =
    new Map<ProjectileId, Phaser.GameObjects.Ellipse>();
  private readonly pickupViews =
    new Map<PickupId, Phaser.GameObjects.Container>();
  private cameraInitialized = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly followActorId?: ActorId,
  ) {
    renderArena(scene, LEVEL_BY_ID["training-crossing"], () => {});
    ensureSpawnPadAnimation(scene);
  }

  render(snapshot: WorldSnapshot): void {
    this.updateCamera(snapshot);
    this.removeMissingActors(snapshot);
    for (const actor of snapshot.actors) {
      this.renderActor(actor);
    }
    this.renderProjectiles(snapshot);
    this.renderPickups(snapshot);
  }

  reset(): void {
    this.cameraInitialized = false;
    this.destroyActorViews();
    this.destroyProjectileViews();
    this.destroyPickupViews();
  }

  dispose(): void {
    this.destroyActorViews();
    this.destroyProjectileViews();
    this.destroyPickupViews();
  }

  private renderActor(actor: Readonly<ActorState>): void {
    const view = this.actorViews.get(actor.id) ?? this.createActorView(actor);
    const height = actor.jump.height;
    const scale = 1 + height / 210;

    view.shadow
      .setPosition(actor.position.x, actor.position.y + 8)
      .setScale(1 + height / 160, Math.max(.35, 1 - height / 95))
      .setAlpha(
        actor.lifeState === "active"
          ? Math.max(.1, .22 - height / 330)
          : 0,
      );
    view.container
      .setPosition(actor.position.x, actor.position.y - height)
      .setScale(scale)
      .setAlpha(actor.lifeState === "active" ? 1 : .35)
      .setVisible(actor.lifeState !== "dead");
    view.sprite
      .setFrame(characterFrame(actor))
      .setTint(actor.lifeState === "falling" ? 0x555555 : 0xffffff);
    this.drawActorStatus(view.status, actor);
  }

  private createActorView(actor: Readonly<ActorState>): ArenaActorView {
    const shadow = this.scene.add.ellipse(
      actor.position.x,
      actor.position.y + 8,
      34,
      14,
      0x000000,
      .2,
    ).setDepth(20);
    const sprite = this.scene.add.sprite(
      0,
      0,
      "arenaCharacters",
      characterFrame(actor),
    ).setScale(.42);
    const status = this.scene.add.graphics();
    const container = this.scene.add.container(
      actor.position.x,
      actor.position.y,
      [sprite, status],
    ).setDepth(35);
    const view = { shadow, container, sprite, status };
    this.actorViews.set(actor.id, view);
    return view;
  }

  private drawActorStatus(
    graphics: Phaser.GameObjects.Graphics,
    actor: Readonly<ActorState>,
  ): void {
    graphics.clear();
    if (actor.lifeState !== "active") {
      return;
    }
    const healthRatio = actor.maxHealth > 0
      ? Phaser.Math.Clamp(actor.health / actor.maxHealth, 0, 1)
      : 0;
    const color = actor.teamId === "blue" ? 0x255ec8 : 0xb7272d;
    graphics.fillStyle(0x10201d, .65).fillRoundedRect(-22, -38, 44, 6, 3);
    graphics.fillStyle(color, 1).fillRoundedRect(
      -22,
      -38,
      44 * healthRatio,
      6,
      3,
    );
    if (actor.armor > 0) {
      graphics.lineStyle(4, 0x29c46a, .95)
        .beginPath()
        .arc(0, 0, actor.radius + 9, -2.55, -.6)
        .strokePath();
    }
  }

  private removeMissingActors(snapshot: WorldSnapshot): void {
    const visibleIds = new Set(snapshot.actors.map((actor) => actor.id));
    for (const [actorId, view] of this.actorViews) {
      if (!visibleIds.has(actorId)) {
        view.shadow.destroy();
        view.container.destroy();
        this.actorViews.delete(actorId);
      }
    }
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
    const color = projectile.teamId === "blue" ? 0x79a9ff : 0xff806f;
    const view = this.projectileViews.get(projectile.id) ??
      this.scene.add.ellipse(
        projectile.position.x,
        projectile.position.y,
        projectile.radius * 2.7,
        projectile.radius * .9,
        color,
        .98,
      ).setDepth(52);
    view
      .setPosition(projectile.position.x, projectile.position.y)
      .setDisplaySize(projectile.radius * 2.7, projectile.radius * .9)
      .setRotation(Math.atan2(projectile.velocity.y, projectile.velocity.x))
      .setFillStyle(color, .98);
    this.projectileViews.set(projectile.id, view);
  }

  private destroyProjectileViews(): void {
    for (const view of this.projectileViews.values()) {
      view.destroy();
    }
    this.projectileViews.clear();
  }

  private renderPickups(snapshot: WorldSnapshot): void {
    const active = snapshot.pickups.filter((pickup) =>
      pickup.lifeState === "active"
    );
    const visibleIds = new Set(active.map((pickup) => pickup.id));
    for (const [pickupId, view] of this.pickupViews) {
      if (!visibleIds.has(pickupId)) {
        view.destroy(true);
        this.pickupViews.delete(pickupId);
      }
    }
    for (const pickup of active) {
      const view = this.pickupViews.get(pickup.id) ??
        this.createPickupView(pickup);
      view.setPosition(pickup.position.x, pickup.position.y);
      const icon = view.getByName("icon") as Phaser.GameObjects.Image;
      const pulse = Math.sin(this.scene.time.now * .003 + pickup.position.x) *
        .012;
      icon.setScale(.28 + pulse);
    }
  }

  private createPickupView(
    pickup: Readonly<PickupState>,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(
      pickup.position.x,
      pickup.position.y,
    ).setDepth(18);
    const pad = this.scene.add.image(0, 2, "spawnPadV2")
      .setScale(.27)
      .setAlpha(.9);
    const glow = this.scene.add.sprite(0, 2, "spawnPadGlowV2")
      .setScale(.27)
      .setAlpha(.72)
      .play("spawn-pad-glow-v2");
    const icon = this.scene.add.image(
      0,
      -5,
      pickup.type === "health" ? "pickupHealth" : "pickupArmor",
    ).setName("icon").setScale(.28);
    container.add([pad, glow, icon]);
    this.pickupViews.set(pickup.id, container);
    return container;
  }

  private destroyPickupViews(): void {
    for (const view of this.pickupViews.values()) {
      view.destroy(true);
    }
    this.pickupViews.clear();
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
    const requested = this.followActorId
      ? snapshot.actors.find((actor) =>
        actor.id === this.followActorId && actor.lifeState === "active"
      )
      : undefined;
    const activePlayers = snapshot.actors.filter((actor) =>
      actor.kind === "player" && actor.lifeState === "active"
    );
    const followed = requested
      ? [requested]
      : activePlayers.length > 0
      ? activePlayers
      : snapshot.actors.slice(0, 1);
    if (followed.length === 0) {
      return;
    }
    const centerX = followed.reduce(
      (sum, actor) => sum + actor.position.x,
      0,
    ) / followed.length;
    const centerY = followed.reduce(
      (sum, actor) => sum + actor.position.y,
      0,
    ) / followed.length;
    const targetScrollX = centerX - camera.width / 2;
    const targetScrollY = centerY - camera.height / 2;
    if (!this.cameraInitialized) {
      camera.centerOn(centerX, centerY);
      this.cameraInitialized = true;
      return;
    }
    camera.setScroll(
      Phaser.Math.Linear(camera.scrollX, targetScrollX, .12),
      Phaser.Math.Linear(camera.scrollY, targetScrollY, .12),
    );
  }
}

function characterFrame(actor: Readonly<ActorState>): number {
  const row = actor.teamId === "blue" ? 4 : 0;
  const direction = Math.abs(actor.facing.x) > Math.abs(actor.facing.y)
    ? actor.facing.x >= 0 ? 1 : 3
    : actor.facing.y >= 0 ? 2 : 0;
  return row * 4 + direction;
}

function ensureSpawnPadAnimation(scene: Phaser.Scene): void {
  if (scene.anims.exists("spawn-pad-glow-v2")) {
    return;
  }
  scene.anims.create({
    key: "spawn-pad-glow-v2",
    frames: scene.anims.generateFrameNumbers("spawnPadGlowV2", {
      start: 0,
      end: 3,
    }),
    frameRate: 2.2,
    repeat: -1,
    yoyo: true,
  });
}
