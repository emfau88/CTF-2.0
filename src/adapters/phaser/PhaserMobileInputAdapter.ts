import Phaser from "phaser";
import type {
  ActorState,
  CoreActionIntent,
  CoreInputFrame,
  WorldPosition,
  WorldSnapshot,
} from "../../core";
import {
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
  V2_V1_WEAPON_PARITY_CONFIG,
} from "../../core";
import type { InputAdapterPort } from "../input";
import { calculateV2TouchLayout } from "./v2TouchLayout";

interface TouchControl {
  id: number;
  x: number;
  y: number;
  radius: number;
  held: boolean;
  pressed: boolean;
  released: boolean;
}

interface TouchStick extends TouchControl {
  originX: number;
  originY: number;
  direction: WorldPosition;
  magnitude: number;
}

interface KeyboardFallbackKeys {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly jump: Phaser.Input.Keyboard.Key;
  readonly rocket: Phaser.Input.Keyboard.Key;
  readonly rail: Phaser.Input.Keyboard.Key;
  readonly whip: Phaser.Input.Keyboard.Key;
}

type WeaponId = "rocket" | "rail" | "whip";
interface WeaponControl extends TouchControl {
  aim: WorldPosition;
  drag: number;
  dragged: boolean;
}

interface WeaponBadgeView {
  readonly image: Phaser.GameObjects.Image;
  readonly text: Phaser.GameObjects.Text;
}

export interface MobileWeaponStatus {
  readonly ammo: number;
  readonly cooldownMs: number;
}

export class PhaserMobileInputAdapter implements InputAdapterPort {
  private sequence = 0;
  private restartRequested = false;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly aimGraphics: Phaser.GameObjects.Graphics;
  private readonly fireLabel: Phaser.GameObjects.Text;
  private readonly jumpLabel: Phaser.GameObjects.Text;
  private readonly weaponViews: Record<WeaponId, Phaser.GameObjects.Image>;
  private readonly weaponBadges: Record<WeaponId, WeaponBadgeView>;
  private readonly moveStick: TouchStick = {
    id: -1,
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
    radius: 58,
    direction: { x: 0, y: 0 },
    magnitude: 0,
    held: false,
    pressed: false,
    released: false,
  };
  private readonly fire: TouchControl = {
    id: -1,
    x: 0,
    y: 0,
    radius: 46,
    held: false,
    pressed: false,
    released: false,
  };
  private readonly jump: TouchControl = {
    id: -1,
    x: 0,
    y: 0,
    radius: 46,
    held: false,
    pressed: false,
    released: false,
  };
  private aim: WorldPosition = { x: 1, y: 0 };
  private readonly keyboardKeys?: KeyboardFallbackKeys;
  private combinedJumpWasHeld = false;
  private queuedWeapon: {
    weaponId: WeaponId;
    direction: WorldPosition;
  } | null = null;
  private readonly weaponControls: Record<WeaponId, WeaponControl> = {
    rocket: createWeaponControl(36),
    rail: createWeaponControl(36),
    whip: createWeaponControl(36),
  };
  private weaponKeyWasHeld: Record<WeaponId, boolean> = {
    rocket: false,
    rail: false,
    whip: false,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actorId = "blue-player",
    private readonly manualFireEnabled = true,
    private readonly weaponStatus?: (weaponId: WeaponId) => MobileWeaponStatus,
    private readonly snapshotProvider?: () => WorldSnapshot,
  ) {
    scene.input.addPointer(2);
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.keyboardKeys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        jump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        rocket: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        rail: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        whip: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      };
    }
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(1100);
    this.aimGraphics = scene.add.graphics().setDepth(1099);
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#17302d",
      align: "center",
    };
    this.fireLabel = scene.add.text(0, 0, "FIRE", labelStyle)
      .setOrigin(.5).setScrollFactor(0).setDepth(1101);
    this.jumpLabel = scene.add.text(0, 0, "JUMP", labelStyle)
      .setOrigin(.5).setScrollFactor(0).setDepth(1101).setVisible(false);
    this.weaponViews = {
      rocket: scene.add.image(0, 0, "uiRocketButton"),
      rail: scene.add.image(0, 0, "uiRailButton"),
      whip: scene.add.image(0, 0, "uiWhipButton"),
    };
    for (const view of Object.values(this.weaponViews)) {
      view.setScrollFactor(0).setDepth(1101);
    }
    this.weaponBadges = {
      rocket: this.createWeaponBadge("uiAmmoBadge", "#17211f"),
      rail: this.createWeaponBadge("uiRailBadge", "#10281a"),
      whip: this.createWeaponBadge("uiAmmoBadge", "#2b1c36"),
    };

    scene.input.on("pointerdown", this.handlePointerDown, this);
    scene.input.on("pointermove", this.handlePointerMove, this);
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.input.on("pointerupoutside", this.handlePointerUp, this);
    scene.scale.on("resize", this.layout, this);
    this.layout(scene.scale.gameSize);
  }

  readFrame(deltaMs: number): CoreInputFrame {
    const keyboardMove = this.readKeyboardMove();
    const moveDirection = this.moveStick.magnitude > .05
      ? { ...this.moveStick.direction }
      : keyboardMove;
    const moveMagnitude = this.moveStick.magnitude > .05
      ? this.moveStick.magnitude
      : Math.hypot(keyboardMove.x, keyboardMove.y);
    if (
      this.moveStick.magnitude <= .05 &&
      (keyboardMove.x !== 0 || keyboardMove.y !== 0)
    ) {
      this.aim = { ...keyboardMove };
    }
    const actions: CoreActionIntent[] = [{
      action: "move",
      phase: "held",
      actorId: this.actorId,
      direction: moveDirection,
      magnitude: moveMagnitude,
    }, {
      action: "aim",
      phase: "held",
      actorId: this.actorId,
      direction: { ...this.aim },
    }];

    this.appendJumpActions(actions);
    this.appendWeaponActions(actions);
    if (this.restartRequested) {
      actions.push({ action: "restartMatch", phase: "pressed" });
      this.restartRequested = false;
    }
    if (this.manualFireEnabled && this.fire.held) {
      actions.push({
        action: "firePrimary",
        phase: "held",
        actorId: this.actorId,
      });
    }

    this.jump.pressed = false;
    this.jump.released = false;
    this.fire.pressed = false;
    this.fire.released = false;
    this.draw();

    return {
      sequence: ++this.sequence,
      timeMs: this.scene.time.now,
      deltaMs: Math.max(0, deltaMs),
      actions,
    };
  }

  reset(): void {
    this.sequence = 0;
    this.restartRequested = false;
    this.releaseControl(this.moveStick);
    this.releaseControl(this.fire);
    this.releaseControl(this.jump);
    for (const control of Object.values(this.weaponControls)) {
      this.releaseControl(control);
    }
    this.combinedJumpWasHeld = false;
    this.queuedWeapon = null;
    this.weaponKeyWasHeld = { rocket: false, rail: false, whip: false };
    this.draw();
  }

  dispose(): void {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
    this.scene.scale.off("resize", this.layout, this);
    this.graphics.destroy();
    this.aimGraphics.destroy();
    this.fireLabel.destroy();
    this.jumpLabel.destroy();
    for (const view of Object.values(this.weaponViews)) {
      view.destroy();
    }
    for (const badge of Object.values(this.weaponBadges)) {
      badge.image.destroy();
      badge.text.destroy();
    }
    for (const key of Object.values(this.keyboardKeys ?? {})) {
      key.destroy();
    }
  }

  requestRestart(): void {
    this.restartRequested = true;
  }

  private appendJumpActions(actions: CoreActionIntent[]): void {
    const jumpHeld = this.jump.held || Boolean(this.keyboardKeys?.jump.isDown);
    if (jumpHeld && !this.combinedJumpWasHeld) {
      actions.push({
        action: "jump",
        phase: "pressed",
        actorId: this.actorId,
      });
    }
    if (jumpHeld) {
      actions.push({
        action: "jump",
        phase: "held",
        actorId: this.actorId,
      });
    }
    if (!jumpHeld && this.combinedJumpWasHeld) {
      actions.push({
        action: "jump",
        phase: "released",
        actorId: this.actorId,
      });
    }
    this.combinedJumpWasHeld = jumpHeld;
  }

  private appendWeaponActions(actions: CoreActionIntent[]): void {
    for (const weaponId of ["rocket", "rail", "whip"] as const) {
      const held = Boolean(this.keyboardKeys?.[weaponId].isDown);
      const queued = this.queuedWeapon?.weaponId === weaponId
        ? this.queuedWeapon
        : null;
      if (queued || (held && !this.weaponKeyWasHeld[weaponId])) {
        actions.push({
          action: "fireWeapon",
          phase: "pressed",
          actorId: this.actorId,
          direction: queued?.direction ?? { ...this.aim },
          payload: { weaponId },
        });
      }
      this.weaponKeyWasHeld[weaponId] = held;
    }
    this.queuedWeapon = null;
  }

  private readKeyboardMove(): WorldPosition {
    if (!this.keyboardKeys) {
      return { x: 0, y: 0 };
    }
    const x = Number(this.keyboardKeys.right.isDown) -
      Number(this.keyboardKeys.left.isDown);
    const y = Number(this.keyboardKeys.down.isDown) -
      Number(this.keyboardKeys.up.isDown);
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    const weapon = this.weaponAt(pointer);
    if (weapon === "whip") {
      this.queueAutoTargetedWeapon(weapon);
    } else if (weapon && this.weaponControls[weapon].id < 0) {
      const control = this.weaponControls[weapon];
      this.captureControl(control, pointer);
      control.drag = 0;
      control.dragged = false;
      this.updateWeaponAim(weapon, pointer);
    } else if (inside(pointer, this.jump, 24) && this.jump.id < 0) {
      this.captureControl(this.jump, pointer);
    } else if (
      this.manualFireEnabled &&
      inside(pointer, this.fire) &&
      this.fire.id < 0
    ) {
      this.captureControl(this.fire, pointer);
      this.updateAim(pointer);
    } else if (
      pointer.x < this.scene.scale.width * .56 &&
      this.moveStick.id < 0
    ) {
      this.captureControl(this.moveStick, pointer);
      this.moveStick.originX = pointer.x;
      this.moveStick.originY = pointer.y;
      this.updateStick(pointer);
    }
    this.draw();
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id === this.moveStick.id) {
      this.updateStick(pointer);
    } else if (pointer.id === this.fire.id) {
      this.updateAim(pointer);
    } else {
      const weapon = this.capturedWeapon(pointer.id);
      if (weapon) {
        this.updateWeaponAim(weapon, pointer);
      }
    }
    this.draw();
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id === this.moveStick.id) {
      this.releaseControl(this.moveStick);
      this.moveStick.direction = { x: 0, y: 0 };
      this.moveStick.magnitude = 0;
      this.moveStick.originX = this.moveStick.x;
      this.moveStick.originY = this.moveStick.y;
    }
    if (pointer.id === this.fire.id) {
      this.releaseControl(this.fire);
    }
    if (pointer.id === this.jump.id) {
      this.releaseControl(this.jump);
    }
    const weapon = this.capturedWeapon(pointer.id);
    if (weapon) {
      const control = this.weaponControls[weapon];
      const direction = resolveMobileWeaponReleaseDirection({
        dragged: control.dragged,
        dragDistance: control.drag,
        manualDirection: control.aim,
        autoDirection: this.autoTargetDirection(weapon),
      });
      if (direction) {
        this.queuedWeapon = {
          weaponId: weapon,
          direction,
        };
      }
      this.releaseControl(control);
      control.drag = 0;
      control.dragged = false;
    }
    this.draw();
  };

  private layout(gameSize: Phaser.Structs.Size): void {
    const layout = calculateV2TouchLayout(gameSize.width, gameSize.height);
    const compact = layout.rocket.r <= 36;
    this.moveStick.radius = layout.joy.r;
    this.moveStick.x = layout.joy.ox;
    this.moveStick.y = layout.joy.oy;
    if (!this.moveStick.held) {
      this.moveStick.originX = this.moveStick.x;
      this.moveStick.originY = this.moveStick.y;
    }
    this.jump.radius = layout.jump.r;
    this.jump.x = layout.jump.x;
    this.jump.y = layout.jump.y;
    this.fire.radius = layout.fire.r;
    this.fire.x = layout.fire.x;
    this.fire.y = layout.fire.y;
    this.fireLabel.setPosition(this.fire.x, this.fire.y)
      .setVisible(this.manualFireEnabled);
    this.jumpLabel.setPosition(this.jump.x, this.jump.y);
    const positions = {
      rocket: layout.rocket,
      rail: layout.rail,
      whip: layout.whip,
    };
    for (const weaponId of ["rocket", "rail", "whip"] as const) {
      Object.assign(this.weaponControls[weaponId], positions[weaponId], {
        radius: positions[weaponId].r,
      });
      this.weaponViews[weaponId]
        .setPosition(positions[weaponId].x, positions[weaponId].y)
        .setScale(weaponId === "whip"
          ? compact ? .42 : .54
          : compact ? .27 : .38)
        .setVisible(this.weaponAvailable(weaponId));
    }
    this.draw();
  }

  private updateStick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.moveStick.originX;
    const dy = pointer.y - this.moveStick.originY;
    const distance = Math.hypot(dx, dy);
    this.moveStick.direction = distance > 0
      ? { x: dx / distance, y: dy / distance }
      : { x: 0, y: 0 };
    this.moveStick.magnitude = Math.min(1, distance / this.moveStick.radius);
  }

  private updateAim(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.fire.x;
    const dy = pointer.y - this.fire.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 10) {
      this.aim = { x: dx / distance, y: dy / distance };
    }
  }

  private updateWeaponAim(
    weaponId: WeaponId,
    pointer: Phaser.Input.Pointer,
  ): void {
    const control = this.weaponControls[weaponId];
    const dx = pointer.x - control.x;
    const dy = pointer.y - control.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 10) {
      control.aim = { x: dx / distance, y: dy / distance };
      this.aim = { ...control.aim };
    }
    control.drag = distance;
    if (distance > 16) control.dragged = true;
  }

  private captureControl(
    control: TouchControl,
    pointer: Phaser.Input.Pointer,
  ): void {
    control.id = pointer.id;
    control.held = true;
    control.pressed = true;
    control.released = false;
  }

  private releaseControl(control: TouchControl): void {
    control.id = -1;
    control.held = false;
    control.pressed = false;
    control.released = true;
  }

  private draw(): void {
    const graphics = this.graphics;
    graphics.clear();
    this.aimGraphics.clear();
    graphics.fillStyle(0xffffff, .38);
    graphics.lineStyle(2, 0x17302d, .2);
    graphics.fillCircle(
      this.moveStick.originX,
      this.moveStick.originY,
      this.moveStick.radius,
    );
    graphics.strokeCircle(
      this.moveStick.originX,
      this.moveStick.originY,
      this.moveStick.radius,
    );
    const knobRadius = this.moveStick.radius <= 50 ? 18 : 22;
    const travel = (this.moveStick.radius - knobRadius + 8) *
      this.moveStick.magnitude;
    graphics.fillStyle(0x17302d, .42);
    graphics.fillCircle(
      this.moveStick.originX + this.moveStick.direction.x * travel,
      this.moveStick.originY + this.moveStick.direction.y * travel,
      knobRadius,
    );
    if (this.manualFireEnabled) {
      const cooldownMs = this.controlledActor()?.primaryFireCooldownMs ?? 0;
      this.drawButton(this.fire, 0xf3c453, cooldownMs <= 0);
      this.fireLabel.setText(
        cooldownMs > 0
          ? `FIRE\n${(Math.ceil(cooldownMs / 100) / 10).toFixed(1)}`
          : "FIRE",
      );
      if (cooldownMs > 0) {
        const ratio = Phaser.Math.Clamp(
          cooldownMs / V2_BASIC_AUTOSHOOT_PARITY_CONFIG.cooldownMs,
          0,
          1,
        );
        graphics.lineStyle(5, 0xf3c453, .72).beginPath()
          .arc(
            this.fire.x,
            this.fire.y,
            this.fire.radius + 5,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * (1 - ratio),
          )
          .strokePath();
      }
    }
    graphics.fillStyle(
      this.jump.held ? 0xffd86b : 0xffffff,
      this.jump.held ? .84 : .52,
    );
    graphics.lineStyle(
      3,
      this.jump.held ? 0xb77516 : 0x17302d,
      .28,
    );
    graphics.fillCircle(this.jump.x, this.jump.y, this.jump.radius);
    graphics.strokeCircle(this.jump.x, this.jump.y, this.jump.radius);
    for (const weaponId of ["rocket", "rail", "whip"] as const) {
      const status = this.weaponStatus?.(weaponId) ?? {
        ammo: 0,
        cooldownMs: 0,
      };
      const available = status.ammo > 0;
      const control = this.weaponControls[weaponId];
      const compact = control.radius <= 36;
      const badgeOffset = compact ? 21 : 27;
      const badge = this.weaponBadges[weaponId];
      const active = control.held && status.cooldownMs <= 0;
      const baseScale = weaponId === "whip"
        ? compact ? .42 : .54
        : compact ? .27 : .38;
      this.weaponViews[weaponId]
        .setVisible(available)
        .setAlpha(status.cooldownMs > 0
          ? weaponId === "rail" ? .62 : .58
          : 1)
        .setScale(
          active && weaponId !== "whip" ? baseScale + .025 : baseScale,
        );
      badge.image
        .setPosition(control.x + badgeOffset, control.y + badgeOffset)
        .setScale(compact ? .1 : .14)
        .setAlpha(.95)
        .setVisible(available);
      badge.text
        .setPosition(control.x + badgeOffset, control.y + badgeOffset)
        .setFontSize(compact ? 12 : 15)
        .setText(String(status.ammo))
        .setVisible(available);
      if (available) {
        this.drawCooldown(weaponId, control, status.cooldownMs);
      }
      if (
        available &&
        control.held &&
        control.dragged &&
        weaponId !== "whip"
      ) {
        this.drawWeaponAim(weaponId, control, status.cooldownMs);
      }
    }
  }

  private drawWeaponAim(
    weaponId: "rocket" | "rail",
    control: WeaponControl,
    cooldownMs: number,
  ): void {
    const ready = cooldownMs <= 0;
    const buttonLength = Math.min(68, Math.max(28, control.drag));
    const color = weaponId === "rocket" ? 0xffd36c : 0x62ff91;
    const lightColor = weaponId === "rocket" ? 0xfff0b2 : 0xcaffd9;
    const alpha = ready ? .8 : .3;
    this.graphics.lineStyle(5, lightColor, ready ? .92 : .38)
      .beginPath()
      .moveTo(control.x, control.y)
      .lineTo(
        control.x + control.aim.x * buttonLength,
        control.y + control.aim.y * buttonLength,
      )
      .strokePath();

    const actor = this.controlledActor();
    if (!actor || actor.lifeState !== "active") return;
    const length = weaponId === "rocket" ? 260 : 310;
    const startX = actor.position.x;
    const startY = actor.position.y - actor.jump.height;
    const endX = startX + control.aim.x * length;
    const endY = startY + control.aim.y * length;
    this.aimGraphics.lineStyle(weaponId === "rocket" ? 4 : 3, color, alpha)
      .beginPath()
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .strokePath();
    this.aimGraphics.fillStyle(lightColor, ready ? .86 : .35)
      .fillCircle(endX, endY, weaponId === "rocket" ? 7 : 6);
  }

  private drawButton(
    control: TouchControl,
    color: number,
    ready = true,
  ): void {
    this.graphics.fillStyle(color, ready ? control.held ? .9 : .55 : .28);
    this.graphics.lineStyle(
      3,
      0x17302d,
      ready ? control.held ? .55 : .25 : .16,
    );
    this.graphics.fillCircle(control.x, control.y, control.radius);
    this.graphics.strokeCircle(control.x, control.y, control.radius);
  }

  private weaponAt(pointer: Phaser.Input.Pointer): WeaponId | null {
    return (["rocket", "rail", "whip"] as const).find((weaponId) =>
      this.weaponAvailable(weaponId) &&
      inside(
        pointer,
        this.weaponControls[weaponId],
        weaponId === "rocket" ? 24 : 20,
      )
    ) ?? null;
  }

  private createWeaponBadge(
    texture: string,
    stroke: string,
  ): WeaponBadgeView {
    const image = this.scene.add.image(0, 0, texture)
      .setScrollFactor(0)
      .setDepth(1102)
      .setVisible(false);
    const text = this.scene.add.text(0, 0, "0", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffffff",
      stroke,
      strokeThickness: 5,
    }).setOrigin(.5).setScrollFactor(0).setDepth(1103).setVisible(false);
    return { image, text };
  }

  private drawCooldown(
    weaponId: WeaponId,
    control: TouchControl,
    cooldownMs: number,
  ): void {
    if (cooldownMs <= 0 || weaponId === "rocket") {
      return;
    }
    const total = weaponId === "rail"
      ? V2_V1_WEAPON_PARITY_CONFIG.railCooldownMs
      : V2_V1_WEAPON_PARITY_CONFIG.whipCooldownMs;
    const ratio = Phaser.Math.Clamp(cooldownMs / total, 0, 1);
    this.graphics.lineStyle(
      5,
      weaponId === "rail" ? 0x62ff91 : 0xf4b35d,
      .72,
    ).beginPath()
      .arc(
        control.x,
        control.y,
        control.radius + 5,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (1 - ratio),
      )
      .strokePath();
  }

  private capturedWeapon(pointerId: number): WeaponId | null {
    return (["rocket", "rail", "whip"] as const).find((weaponId) =>
      this.weaponControls[weaponId].id === pointerId
    ) ?? null;
  }

  private weaponAvailable(weaponId: WeaponId): boolean {
    return (this.weaponStatus?.(weaponId).ammo ?? 0) > 0;
  }

  private queueAutoTargetedWeapon(weaponId: WeaponId): void {
    this.queuedWeapon = {
      weaponId,
      direction: this.autoTargetDirection(weaponId),
    };
  }

  private autoTargetDirection(weaponId: WeaponId): WorldPosition {
    const snapshot = this.snapshotProvider?.();
    if (!snapshot) {
      return { ...this.aim };
    }
    return resolveMobileWeaponTapDirection(
      snapshot,
      this.actorId,
      weaponId,
      this.aim,
    );
  }

  private controlledActor(
    snapshot = this.snapshotProvider?.(),
  ): Readonly<ActorState> | undefined {
    return snapshot?.actors.find((actor) => actor.id === this.actorId);
  }
}

function inside(
  pointer: Phaser.Input.Pointer,
  control: TouchControl,
  padding = 18,
): boolean {
  return Phaser.Math.Distance.Between(
    pointer.x,
    pointer.y,
    control.x,
    control.y,
  ) <= control.radius + padding;
}

function createTouchControl(radius: number): TouchControl {
  return {
    id: -1,
    x: 0,
    y: 0,
    radius,
    held: false,
    pressed: false,
    released: false,
  };
}

function createWeaponControl(radius: number): WeaponControl {
  return {
    ...createTouchControl(radius),
    aim: { x: 1, y: 0 },
    drag: 0,
    dragged: false,
  };
}

function distance(left: WorldPosition, right: WorldPosition): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function normalizeDirection(direction: WorldPosition): WorldPosition {
  const length = Math.hypot(direction.x, direction.y);
  return length > .001
    ? { x: direction.x / length, y: direction.y / length }
    : { x: 1, y: 0 };
}

export function resolveMobileWeaponTapDirection(
  snapshot: WorldSnapshot,
  actorId: string,
  weaponId: WeaponId,
  fallbackAim: WorldPosition,
): WorldPosition {
  const owner = snapshot.actors.find((actor) => actor.id === actorId);
  if (!owner) return normalizeDirection(fallbackAim);
  const maxRange = weaponId === "rail"
    ? V2_V1_WEAPON_PARITY_CONFIG.railRange
    : weaponId === "whip"
    ? V2_V1_WEAPON_PARITY_CONFIG.whipRange
    : Number.POSITIVE_INFINITY;
  const target = snapshot.actors
    .filter((candidate) =>
      candidate.id !== owner.id &&
      candidate.lifeState === "active" &&
      candidate.teamId !== owner.teamId
    )
    .filter((candidate) =>
      distance(owner.position, candidate.position) <= maxRange
    )
    .filter((candidate) =>
      !snapshot.geometry.solids.some((solid) =>
        lineIntersectsRect(owner.position, candidate.position, solid)
      )
    )
    .sort((left, right) =>
      distance(owner.position, left.position) -
      distance(owner.position, right.position)
    )[0];
  const fallback = owner.lastMoveDirection.x !== 0 ||
      owner.lastMoveDirection.y !== 0
    ? owner.lastMoveDirection
    : fallbackAim;
  return normalizeDirection(
    target
      ? {
        x: target.position.x - owner.position.x,
        y: target.position.y - owner.position.y,
      }
      : fallback,
  );
}

export function resolveMobileWeaponReleaseDirection(input: {
  readonly dragged: boolean;
  readonly dragDistance: number;
  readonly manualDirection: WorldPosition;
  readonly autoDirection: WorldPosition;
}): WorldPosition | null {
  if (input.dragged && input.dragDistance < 18) return null;
  return normalizeDirection(
    input.dragged ? input.manualDirection : input.autoDirection,
  );
}

function lineIntersectsRect(
  from: WorldPosition,
  to: WorldPosition,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  if (pointInRect(from, rect) || pointInRect(to, rect)) return true;
  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };
  return segmentsIntersect(from, to, topLeft, topRight) ||
    segmentsIntersect(from, to, topRight, bottomRight) ||
    segmentsIntersect(from, to, bottomRight, bottomLeft) ||
    segmentsIntersect(from, to, bottomLeft, topLeft);
}

function pointInRect(
  point: WorldPosition,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height;
}

function segmentsIntersect(
  a: WorldPosition,
  b: WorldPosition,
  c: WorldPosition,
  d: WorldPosition,
): boolean {
  const counterClockwise = (
    p1: WorldPosition,
    p2: WorldPosition,
    p3: WorldPosition,
  ) => (p3.y - p1.y) * (p2.x - p1.x) >
    (p2.y - p1.y) * (p3.x - p1.x);
  return counterClockwise(a, c, d) !== counterClockwise(b, c, d) &&
    counterClockwise(a, b, c) !== counterClockwise(a, b, d);
}
