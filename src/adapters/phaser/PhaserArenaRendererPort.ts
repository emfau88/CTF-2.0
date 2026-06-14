import Phaser from "phaser";
import type {
  ActorId,
  ActorState,
  PickupId,
  PickupState,
  ProjectileId,
  ProjectileState,
  WorldMapData,
  WorldSnapshot,
} from "../../core";
import { renderArena } from "../../arenaRenderer";
import type { LevelData } from "../../level";
import type { RendererPort } from "../rendering";

interface ArenaActorView {
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly status: Phaser.GameObjects.Graphics;
}

interface SpawnPadParticle {
  x: number;
  y: number;
  offsetX: number;
  lifeMs: number;
  maxLifeMs: number;
  size: number;
}

interface LibraryDustParticle {
  x: number;
  y: number;
  speed: number;
  drift: number;
  phase: number;
  size: number;
  alpha: number;
}

export class PhaserArenaRendererPort implements RendererPort {
  private readonly actorViews = new Map<ActorId, ArenaActorView>();
  private readonly projectileViews =
    new Map<ProjectileId, Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image>();
  private readonly pickupViews =
    new Map<PickupId, Phaser.GameObjects.Container>();
  private readonly objectiveViews =
    new Map<string, Phaser.GameObjects.Image>();
  private readonly spawnPadParticleGraphics: Phaser.GameObjects.Graphics;
  private readonly libraryDustGraphics?: Phaser.GameObjects.Graphics;
  private readonly libraryDust: LibraryDustParticle[] = [];
  private spawnPadParticles: SpawnPadParticle[] = [];
  private spawnPadParticleTimerMs = 0;
  private lastRenderTimeMs = 0;
  private lastLibraryTimeMs = 0;
  private cameraInitialized = false;

  constructor(
    private readonly scene: Phaser.Scene,
    map: WorldMapData,
    private readonly followActorId?: ActorId,
  ) {
    const level = toPresentationLevel(map);
    ensureLibraryCandleAnimation(scene);
    renderArena(scene, level, (x, y) => this.addLibraryCandles(x, y));
    if (map.presentation.theme === "library") {
      this.libraryDustGraphics = scene.add.graphics().setDepth(8);
      this.libraryDust.push(...createLibraryDust(map));
      this.addLibrarySpiders(map);
    }
    ensureSpawnPadAnimation(scene);
    this.spawnPadParticleGraphics = scene.add.graphics().setDepth(19);
  }

  render(snapshot: WorldSnapshot): void {
    this.updateCamera(snapshot);
    this.removeMissingActors(snapshot);
    for (const actor of snapshot.actors) {
      this.renderActor(actor);
    }
    this.renderProjectiles(snapshot);
    this.renderPickups(snapshot);
    this.renderObjectives(snapshot);
    this.renderSpawnPadParticles(snapshot);
    this.renderLibraryAtmosphere(snapshot.timeMs);
  }

  reset(): void {
    this.cameraInitialized = false;
    this.lastLibraryTimeMs = 0;
    this.destroyActorViews();
    this.destroyProjectileViews();
    this.destroyPickupViews();
    this.destroyObjectiveViews();
    this.resetSpawnPadParticles();
  }

  dispose(): void {
    this.destroyActorViews();
    this.destroyProjectileViews();
    this.destroyPickupViews();
    this.destroyObjectiveViews();
    this.spawnPadParticleGraphics.destroy();
    this.libraryDustGraphics?.destroy();
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
      this.createProjectileView(projectile, color);
    view
      .setPosition(projectile.position.x, projectile.position.y)
      .setRotation(Math.atan2(projectile.velocity.y, projectile.velocity.x));
    if (view instanceof Phaser.GameObjects.Ellipse) {
      view.setDisplaySize(projectile.radius * 2.7, projectile.radius * .9);
      view.setFillStyle(color, .98);
    } else {
      view.setScale(.46);
    }
    this.projectileViews.set(projectile.id, view);
  }

  private createProjectileView(
    projectile: Readonly<ProjectileState>,
    color: number,
  ): Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image {
    if (projectile.weaponId === "rocket") {
      return this.scene.add.image(
        projectile.position.x,
        projectile.position.y,
        "rocketProjectile",
        2,
      ).setScale(.46).setDepth(52);
    }
    return this.scene.add.ellipse(
      projectile.position.x,
      projectile.position.y,
      projectile.radius * 2.7,
      projectile.radius * .9,
      color,
      .98,
    ).setDepth(52);
  }

  private destroyProjectileViews(): void {
    for (const view of this.projectileViews.values()) {
      view.destroy();
    }
    this.projectileViews.clear();
  }

  private renderPickups(snapshot: WorldSnapshot): void {
    const visibleIds = new Set(snapshot.pickups.map((pickup) => pickup.id));
    for (const [pickupId, view] of this.pickupViews) {
      if (!visibleIds.has(pickupId)) {
        view.destroy(true);
        this.pickupViews.delete(pickupId);
      }
    }
    for (const pickup of snapshot.pickups) {
      const view = this.pickupViews.get(pickup.id) ??
        this.createPickupView(pickup);
      view.setPosition(pickup.position.x, pickup.position.y);
      const active = pickup.lifeState === "active";
      const glow = view.getByName("pad-glow") as Phaser.GameObjects.Sprite;
      const icon = view.getByName("icon") as Phaser.GameObjects.Image;
      const pulse = Math.sin(this.scene.time.now * .003 + pickup.position.x) *
        .008;
      glow.setVisible(active);
      icon
        .setVisible(active)
        .setScale(pickupIconScale(pickup.type) + pulse);
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
      .setName("pad")
      .setScale(.27)
      .setAlpha(.9);
    const glow = this.scene.add.sprite(0, 2, "spawnPadGlowV2")
      .setName("pad-glow")
      .setScale(.27)
      .setAlpha(.72)
      .play("spawn-pad-glow-v2");
    const icon = this.scene.add.image(
      0,
      isWeaponPickup(pickup.type) ? -3 : -5,
      pickupTexture(pickup.type),
    ).setName("icon").setScale(pickupIconScale(pickup.type));
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

  private renderObjectives(snapshot: WorldSnapshot): void {
    const visibleIds = new Set(snapshot.objectives.map((objective) =>
      objective.id
    ));
    for (const [objectiveId, view] of this.objectiveViews) {
      if (!visibleIds.has(objectiveId)) {
        view.destroy();
        this.objectiveViews.delete(objectiveId);
      }
    }
    for (const objective of snapshot.objectives) {
      if (objective.kind !== "team-flag") continue;
      const teamId = objective.state.controllingTeamId;
      if (teamId !== "red" && teamId !== "blue") continue;
      const view = this.objectiveViews.get(objective.id) ??
        this.scene.add.image(
          objective.position.x,
          objective.position.y - 18,
          teamId === "red" ? "flagRed" : "flagBlue",
        ).setDepth(34).setScale(.25);
      view
        .setPosition(objective.position.x, objective.position.y - 18)
        .setScale(.25)
        .setAlpha(objective.state.status === "carried" ? .94 : 1);
      this.objectiveViews.set(objective.id, view);
    }
  }

  private destroyObjectiveViews(): void {
    for (const view of this.objectiveViews.values()) view.destroy();
    this.objectiveViews.clear();
  }

  private renderSpawnPadParticles(snapshot: WorldSnapshot): void {
    const now = this.scene.time.now;
    const deltaMs = this.lastRenderTimeMs > 0
      ? Math.min(100, Math.max(0, now - this.lastRenderTimeMs))
      : 0;
    this.lastRenderTimeMs = now;
    this.spawnPadParticleTimerMs -= deltaMs;
    if (this.spawnPadParticleTimerMs <= 0) {
      this.spawnPadParticleTimerMs = 95;
      for (const pickup of snapshot.pickups) {
        const lifeMs = Phaser.Math.Between(620, 920);
        this.spawnPadParticles.push({
          x: pickup.position.x + Phaser.Math.Between(-14, 14),
          y: pickup.position.y - 2 + Phaser.Math.Between(-4, 7),
          offsetX: Phaser.Math.FloatBetween(-8, 8),
          lifeMs,
          maxLifeMs: lifeMs,
          size: Phaser.Math.FloatBetween(2.2, 4.2),
        });
      }
    }
    for (const particle of this.spawnPadParticles) {
      particle.lifeMs -= deltaMs;
    }
    this.spawnPadParticles = this.spawnPadParticles.filter(
      (particle) => particle.lifeMs > 0,
    );

    const graphics = this.spawnPadParticleGraphics;
    graphics.clear();
    for (const particle of this.spawnPadParticles) {
      const progress = 1 - particle.lifeMs / particle.maxLifeMs;
      const alpha = Phaser.Math.Clamp(
        particle.lifeMs / particle.maxLifeMs,
        0,
        1,
      ) * .45;
      graphics.fillStyle(0x7dfcff, alpha).fillCircle(
        particle.x + particle.offsetX * progress,
        particle.y - progress * 34,
        particle.size * (1 - progress * .35),
      );
    }
  }

  private resetSpawnPadParticles(): void {
    this.spawnPadParticles = [];
    this.spawnPadParticleTimerMs = 0;
    this.lastRenderTimeMs = 0;
    this.spawnPadParticleGraphics.clear();
  }

  private addLibraryCandles(x: number, y: number): void {
    const points = [{ x: 0, y: -14 }, { x: 7, y: -4 }, { x: -7, y: -4 }];
    for (const [index, point] of points.entries()) {
      const flameX = x + point.x;
      const flameY = y + point.y - 6;
      const glow = this.scene.add.circle(
        flameX,
        flameY + 1,
        15,
        0xffc45a,
        .13,
      ).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
      const flame = this.scene.add.sprite(
        flameX,
        flameY,
        "libraryCandleFlame",
      ).setDisplaySize(12, 12)
        .setDepth(4)
        .play({ key: "library-candle-flicker", startFrame: index * 2 });
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: .08, to: .18 },
        duration: 180 + index * 45,
        yoyo: true,
        repeat: -1,
      });
      this.scene.tweens.add({
        targets: flame,
        alpha: { from: index === 1 ? .72 : .88, to: 1 },
        duration: 160 + index * 40,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private addLibrarySpiders(map: WorldMapData): void {
    const width = map.geometry.bounds.maxX - map.geometry.bounds.minX;
    const routes = [
      { x: 420, y: 142, dx: 42, dy: 8, flip: false },
      { x: width - 420, y: 684, dx: -38, dy: -6, flip: true },
    ];
    for (const [index, route] of routes.entries()) {
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

  private renderLibraryAtmosphere(timeMs: number): void {
    if (!this.libraryDustGraphics) {
      return;
    }
    const deltaMs = this.lastLibraryTimeMs > 0
      ? Math.max(0, timeMs - this.lastLibraryTimeMs)
      : 0;
    this.lastLibraryTimeMs = timeMs;
    const dt = Math.min(deltaMs, 100) / 1000;
    const bounds = this.scene.cameras.main.getBounds();
    for (const dust of this.libraryDust) {
      dust.phase += dt * .7;
      dust.y -= dust.speed * dt;
      dust.x += Math.sin(dust.phase) * dust.drift * dt;
      if (dust.y < 55) {
        dust.y = bounds.height - 55;
        dust.x = Phaser.Math.Between(270, bounds.width - 270);
      }
    }
    this.libraryDustGraphics.clear();
    for (const dust of this.libraryDust) {
      const pulse = .72 + Math.sin(dust.phase * 1.7) * .28;
      this.libraryDustGraphics.fillStyle(
        0xffe8b0,
        dust.alpha * pulse,
      ).fillCircle(dust.x, dust.y, dust.size);
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

function toPresentationLevel(map: WorldMapData): LevelData {
  const bounds = map.geometry.bounds;
  const redSpawn = map.spawnPoints.find((spawn) =>
    spawn.id === "red-player-spawn"
  )?.position ?? map.diagnosticSpawn;
  const blueSpawn = map.spawnPoints.find((spawn) =>
    spawn.id === "blue-player-spawn"
  )?.position ?? map.diagnosticSpawn;
  const rect = (
    value: { x: number; y: number; width: number; height: number },
  ) => ({
    x: value.x,
    y: value.y,
    w: value.width,
    h: value.height,
  });
  return {
    id: map.id,
    name: map.displayName,
    plan: map.presentation.plan,
    theme: map.presentation.theme,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    redSpawn: { ...redSpawn },
    blueSpawn: { ...blueSpawn },
    redBase: rect(map.presentation.redBase),
    blueBase: rect(map.presentation.blueBase),
    walls: map.presentation.walls.map((wall) => ({
      ...rect(wall),
      visual: wall.visual,
    })),
    gaps: map.presentation.gaps.map((gap) => ({
      ...rect(gap),
      visual: gap.visual,
    })),
    decorations: map.presentation.decorations?.map((decoration) => ({
      ...rect(decoration),
      kind: decoration.kind,
    })),
    combatZone: map.presentation.combatZone
      ? rect(map.presentation.combatZone)
      : undefined,
    pickups: map.pickupSpawns.map((pickup) => ({
      kind: pickup.type,
      x: pickup.position.x,
      y: pickup.position.y,
    })),
    botRoutes: {
      attacker: map.presentation.botRoutes.attacker.map((point) => ({
        ...point,
      })),
      defender: map.presentation.botRoutes.defender.map((point) => ({
        ...point,
      })),
    },
  };
}

function createLibraryDust(map: WorldMapData): LibraryDustParticle[] {
  const width = map.geometry.bounds.maxX - map.geometry.bounds.minX;
  const height = map.geometry.bounds.maxY - map.geometry.bounds.minY;
  return Array.from({ length: 34 }, (_, index) => ({
    x: Phaser.Math.Between(270, width - 270),
    y: Phaser.Math.Between(70, height - 70),
    speed: Phaser.Math.FloatBetween(3.5, 8),
    drift: Phaser.Math.FloatBetween(2, 7) * (index % 2 ? 1 : -1),
    phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
    size: Phaser.Math.FloatBetween(.8, 1.8),
    alpha: Phaser.Math.FloatBetween(.08, .2),
  }));
}

function pickupTexture(type: PickupState["type"]): string {
  if (type === "health") return "pickupHealth";
  if (type === "armor") return "pickupArmor";
  if (type === "rocket") return "pickupRocket";
  if (type === "rail") return "pickupRail";
  return "pickupWhip";
}

function pickupIconScale(type: PickupState["type"]): number {
  if (type === "rail") return .22;
  if (type === "whip") return .34;
  return .18;
}

function isWeaponPickup(type: PickupState["type"]): boolean {
  return type === "rocket" || type === "rail" || type === "whip";
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

function ensureLibraryCandleAnimation(scene: Phaser.Scene): void {
  if (scene.anims.exists("library-candle-flicker")) {
    return;
  }
  scene.anims.create({
    key: "library-candle-flicker",
    frames: scene.anims.generateFrameNumbers("libraryCandleFlame", {
      start: 0,
      end: 5,
    }),
    frameRate: 10,
    repeat: -1,
    yoyo: true,
  });
}
