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

export class PhaserMobileInputAdapter implements InputAdapterPort {
  private sequence = 0;
  private restartRequested = false;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly fireLabel: Phaser.GameObjects.Text;
  private readonly jumpLabel: Phaser.GameObjects.Text;
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actorId = "blue-player",
    private readonly manualFireEnabled = true,
  ) {
    scene.input.addPointer(2);
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

    scene.input.on("pointerdown", this.handlePointerDown, this);
    scene.input.on("pointermove", this.handlePointerMove, this);
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.input.on("pointerupoutside", this.handlePointerUp, this);
    scene.scale.on("resize", this.layout, this);
    this.layout(scene.scale.gameSize);
  }

  readFrame(deltaMs: number): CoreInputFrame {
    const actions: CoreActionIntent[] = [{
      action: "move",
      phase: "held",
      actorId: this.actorId,
      direction: { ...this.moveStick.direction },
      magnitude: this.moveStick.magnitude,
    }, {
      action: "aim",
      phase: "held",
      actorId: this.actorId,
      direction: { ...this.aim },
    }];

    this.appendJumpActions(actions);
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
  }

  requestRestart(): void {
    this.restartRequested = true;
  }

  private appendJumpActions(actions: CoreActionIntent[]): void {
    if (this.jump.pressed) {
      actions.push({
        action: "jump",
        phase: "pressed",
        actorId: this.actorId,
      });
    }
    if (this.jump.held) {
      actions.push({
        action: "jump",
        phase: "held",
        actorId: this.actorId,
      });
    }
    if (this.jump.released) {
      actions.push({
        action: "jump",
        phase: "released",
        actorId: this.actorId,
      });
    }
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (inside(pointer, this.jump) && this.jump.id < 0) {
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
  }

  private drawButton(control: TouchControl, color: number): void {
    this.graphics.fillStyle(color, control.held ? .9 : .55);
    this.graphics.lineStyle(3, 0x17302d, control.held ? .55 : .25);
    this.graphics.fillCircle(control.x, control.y, control.radius);
    this.graphics.strokeCircle(control.x, control.y, control.radius);
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
