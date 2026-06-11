import Phaser from "phaser";
import type {
  CoreActionIntent,
  CoreInputFrame,
  WorldPosition,
} from "../../core";
import type { InputAdapterPort } from "../input";

interface DiagnosticKeys {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly jump: Phaser.Input.Keyboard.Key;
  readonly firePrimary: Phaser.Input.Keyboard.Key;
  readonly fireSpecial: Phaser.Input.Keyboard.Key;
}

export class PhaserDiagnosticInputAdapter implements InputAdapterPort {
  private readonly keys: DiagnosticKeys;
  private sequence = 0;
  private jumpWasHeld = false;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Phaser keyboard input is required for V2 diagnostics.");
    }

    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      firePrimary: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      fireSpecial: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    };
  }

  readFrame(deltaMs: number): CoreInputFrame {
    const actions: CoreActionIntent[] = [];
    const move = this.readMoveDirection();
    const aim = this.readAimDirection();
    const jumpHeld = this.keys.jump.isDown;
    const pointer = this.scene.input.activePointer;
    const firePrimary = this.keys.firePrimary.isDown || pointer.isDown;
    const fireSpecial =
      this.keys.fireSpecial.isDown || pointer.rightButtonDown();

    actions.push({
      action: "move",
      phase: "held",
      direction: move,
      magnitude: Math.hypot(move.x, move.y),
    });
    actions.push({
      action: "aim",
      phase: "held",
      direction: aim,
    });

    if (jumpHeld && !this.jumpWasHeld) {
      actions.push({ action: "jump", phase: "pressed" });
    }
    if (jumpHeld) {
      actions.push({ action: "jump", phase: "held" });
    }
    if (!jumpHeld && this.jumpWasHeld) {
      actions.push({ action: "jump", phase: "released" });
    }
    if (firePrimary) {
      actions.push({ action: "firePrimary", phase: "held" });
    }
    if (fireSpecial) {
      actions.push({ action: "fireSpecial", phase: "held" });
    }

    this.jumpWasHeld = jumpHeld;
    return {
      sequence: ++this.sequence,
      timeMs: this.scene.time.now,
      deltaMs: Math.max(0, deltaMs),
      actions,
    };
  }

  reset(): void {
    this.sequence = 0;
    this.jumpWasHeld = false;
  }

  dispose(): void {
    for (const key of Object.values(this.keys)) {
      key.destroy();
    }
  }

  private readMoveDirection(): WorldPosition {
    const x = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    const y = Number(this.keys.down.isDown) - Number(this.keys.up.isDown);
    const length = Math.hypot(x, y);

    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  private readAimDirection(): WorldPosition {
    const pointer = this.scene.input.activePointer;
    const x = pointer.x - this.scene.scale.width / 2;
    const y = pointer.y - this.scene.scale.height / 2;
    const length = Math.hypot(x, y);

    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
  }
}
