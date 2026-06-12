import Phaser from "phaser";
import type {
  CoreActionIntent,
  CoreInputFrame,
  WorldPosition,
} from "../../core";
import type { InputAdapterPort } from "../input";

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
export interface MobileWeaponStatus {
  readonly ammo: number;
  readonly cooldownMs: number;
}

export class PhaserMobileInputAdapter implements InputAdapterPort {
  private sequence = 0;
  private restartRequested = false;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly fireLabel: Phaser.GameObjects.Text;
  private readonly jumpLabel: Phaser.GameObjects.Text;
  private readonly weaponViews: Record<WeaponId, Phaser.GameObjects.Image>;
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
  private queuedWeapon: WeaponId | null = null;
  private readonly weaponControls: Record<WeaponId, TouchControl> = {
    rocket: createTouchControl(36),
    rail: createTouchControl(36),
    whip: createTouchControl(36),
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
      .setOrigin(.5).setScrollFactor(0).setDepth(1101);
    this.weaponViews = {
      rocket: scene.add.image(0, 0, "uiRocketButton"),
      rail: scene.add.image(0, 0, "uiRailButton"),
      whip: scene.add.image(0, 0, "uiWhipButton"),
    };
    for (const view of Object.values(this.weaponViews)) {
      view.setScrollFactor(0).setDepth(1101);
    }

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
    this.fireLabel.destroy();
    this.jumpLabel.destroy();
    for (const view of Object.values(this.weaponViews)) {
      view.destroy();
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
      if (
        this.queuedWeapon === weaponId ||
        (held && !this.weaponKeyWasHeld[weaponId])
      ) {
        actions.push({
          action: "fireWeapon",
          phase: "pressed",
          actorId: this.actorId,
          direction: { ...this.aim },
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
    if (weapon && this.weaponControls[weapon].id < 0) {
      this.captureControl(this.weaponControls[weapon], pointer);
      this.updateWeaponAim(weapon, pointer);
    } else if (inside(pointer, this.jump) && this.jump.id < 0) {
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
      this.queuedWeapon = weapon;
      this.releaseControl(this.weaponControls[weapon]);
    }
    this.draw();
  };

  private layout(gameSize: Phaser.Structs.Size): void {
    const compact = gameSize.width <= 720 || gameSize.height <= 520;
    const edge = compact ? 62 : 88;
    const bottom = gameSize.height - edge;
    this.moveStick.radius = compact ? 50 : 62;
    this.moveStick.x = edge;
    this.moveStick.y = bottom;
    if (!this.moveStick.held) {
      this.moveStick.originX = this.moveStick.x;
      this.moveStick.originY = this.moveStick.y;
    }
    this.jump.radius = compact ? 42 : 50;
    this.jump.x = gameSize.width - edge;
    this.jump.y = bottom;
    this.fire.radius = compact ? 38 : 46;
    this.fire.x = this.jump.x - (compact ? 94 : 116);
    this.fire.y = bottom + (compact ? 4 : 8);
    this.fireLabel.setPosition(this.fire.x, this.fire.y)
      .setVisible(this.manualFireEnabled);
    this.jumpLabel.setPosition(this.jump.x, this.jump.y);
    const weaponRadius = compact ? 34 : 40;
    const positions = {
      rocket: { x: this.jump.x - (compact ? 88 : 112), y: bottom + 2 },
      rail: {
        x: this.jump.x - (compact ? 62 : 82),
        y: bottom - (compact ? 76 : 96),
      },
      whip: {
        x: this.jump.x - (compact ? 140 : 174),
        y: bottom - (compact ? 68 : 88),
      },
    };
    for (const weaponId of ["rocket", "rail", "whip"] as const) {
      Object.assign(this.weaponControls[weaponId], positions[weaponId], {
        radius: weaponRadius,
      });
      this.weaponViews[weaponId]
        .setPosition(positions[weaponId].x, positions[weaponId].y)
        .setScale(weaponId === "whip"
          ? compact ? .38 : .48
          : compact ? .28 : .36)
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
      this.aim = { x: dx / distance, y: dy / distance };
    }
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
    const travel = this.moveStick.radius * .58 * this.moveStick.magnitude;
    graphics.fillStyle(0x17302d, .46);
    graphics.fillCircle(
      this.moveStick.originX + this.moveStick.direction.x * travel,
      this.moveStick.originY + this.moveStick.direction.y * travel,
      this.moveStick.radius * .34,
    );
    if (this.manualFireEnabled) {
      this.drawButton(this.fire, 0xf3c453);
    }
    this.drawButton(this.jump, 0xffffff);
    for (const [weaponId, color] of [
      ["rocket", 0xf0b94b],
      ["rail", 0x67e894],
      ["whip", 0xd38af1],
    ] as const) {
      const status = this.weaponStatus?.(weaponId) ?? {
        ammo: 0,
        cooldownMs: 0,
      };
      const available = status.ammo > 0;
      this.weaponViews[weaponId]
        .setVisible(available)
        .setAlpha(status.cooldownMs > 0 ? .58 : 1);
      if (available) {
        this.drawButton(this.weaponControls[weaponId], color);
      }
    }
  }

  private drawButton(control: TouchControl, color: number): void {
    this.graphics.fillStyle(color, control.held ? .9 : .55);
    this.graphics.lineStyle(3, 0x17302d, control.held ? .55 : .25);
    this.graphics.fillCircle(control.x, control.y, control.radius);
    this.graphics.strokeCircle(control.x, control.y, control.radius);
  }

  private weaponAt(pointer: Phaser.Input.Pointer): WeaponId | null {
    return (["rocket", "rail", "whip"] as const).find((weaponId) =>
      this.weaponAvailable(weaponId) &&
      inside(pointer, this.weaponControls[weaponId])
    ) ?? null;
  }

  private capturedWeapon(pointerId: number): WeaponId | null {
    return (["rocket", "rail", "whip"] as const).find((weaponId) =>
      this.weaponControls[weaponId].id === pointerId
    ) ?? null;
  }

  private weaponAvailable(weaponId: WeaponId): boolean {
    return (this.weaponStatus?.(weaponId).ammo ?? 0) > 0;
  }
}

function inside(
  pointer: Phaser.Input.Pointer,
  control: TouchControl,
): boolean {
  return Phaser.Math.Distance.Between(
    pointer.x,
    pointer.y,
    control.x,
    control.y,
  ) <= control.radius + 18;
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
