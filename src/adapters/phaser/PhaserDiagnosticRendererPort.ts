import Phaser from "phaser";
import type { ActorId, ActorState, WorldSnapshot } from "../../core";
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

  constructor(private readonly scene: Phaser.Scene) {}

  render(snapshot: WorldSnapshot): void {
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
  }

  reset(): void {
    this.destroyActorViews();
  }

  dispose(): void {
    this.destroyActorViews();
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
      actor.id,
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
    const body = this.scene.add.circle(0, 0, actor.radius, 0x3a8f88)
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
}
