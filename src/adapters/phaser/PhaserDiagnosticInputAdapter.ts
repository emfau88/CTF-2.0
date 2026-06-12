import Phaser from "phaser";
import { V2_ACTOR_LIFECYCLE_CONFIG } from "../../core";
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
  readonly debugDamage: Phaser.Input.Keyboard.Key;
  readonly debugScore: Phaser.Input.Keyboard.Key;
  readonly restartMatch: Phaser.Input.Keyboard.Key;
  readonly redUp: Phaser.Input.Keyboard.Key;
  readonly redDown: Phaser.Input.Keyboard.Key;
  readonly redLeft: Phaser.Input.Keyboard.Key;
  readonly redRight: Phaser.Input.Keyboard.Key;
  readonly redJump: Phaser.Input.Keyboard.Key;
  readonly redFire: Phaser.Input.Keyboard.Key;
}

export type PhaserInputProfile = "diagnostic" | "tdm";

export class PhaserDiagnosticInputAdapter implements InputAdapterPort {
  private readonly keys: DiagnosticKeys;
  private sequence = 0;
  private jumpWasHeld = false;
  private damageWasHeld = false;
  private scoreWasHeld = false;
  private restartWasHeld = false;
  private redJumpWasHeld = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly profile: PhaserInputProfile = "diagnostic",
  ) {
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
      debugDamage: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      debugScore: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      restartMatch: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      redUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      redDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      redLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      redRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      redJump: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      redFire: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
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

    const blueActorId = this.profile === "tdm" ? "blue-player" : undefined;
    actions.push({
      action: "move",
      phase: "held",
      actorId: blueActorId,
      direction: move,
      magnitude: Math.hypot(move.x, move.y),
    });
    actions.push({
      action: "aim",
      phase: "held",
      actorId: blueActorId,
      direction: aim,
    });

    if (jumpHeld && !this.jumpWasHeld) {
      actions.push({ action: "jump", phase: "pressed", actorId: blueActorId });
    }
    if (jumpHeld) {
      actions.push({ action: "jump", phase: "held", actorId: blueActorId });
    }
    if (!jumpHeld && this.jumpWasHeld) {
      actions.push({ action: "jump", phase: "released", actorId: blueActorId });
    }
    if (firePrimary) {
      actions.push({
        action: "firePrimary",
        phase: "held",
        actorId: blueActorId,
      });
    }
    if (fireSpecial) {
      actions.push({ action: "fireSpecial", phase: "held" });
    }
    if (
      this.profile === "diagnostic" &&
      this.keys.debugDamage.isDown &&
      !this.damageWasHeld
    ) {
      actions.push({
        action: "debugDamage",
        phase: "pressed",
        payload: { amount: V2_ACTOR_LIFECYCLE_CONFIG.diagnosticDamage },
      });
    }
    if (
      this.profile === "diagnostic" &&
      this.keys.debugScore.isDown &&
      !this.scoreWasHeld
    ) {
      actions.push({ action: "debugScore", phase: "pressed" });
    }
    if (this.keys.restartMatch.isDown && !this.restartWasHeld) {
      actions.push({ action: "restartMatch", phase: "pressed" });
    }
    if (this.profile === "tdm") {
      this.appendRedPlayerActions(actions);
    }

    this.jumpWasHeld = jumpHeld;
    this.damageWasHeld = this.keys.debugDamage.isDown;
    this.scoreWasHeld = this.keys.debugScore.isDown;
    this.restartWasHeld = this.keys.restartMatch.isDown;
    this.redJumpWasHeld = this.keys.redJump.isDown;
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
    this.damageWasHeld = false;
    this.scoreWasHeld = false;
    this.restartWasHeld = false;
    this.redJumpWasHeld = false;
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

  private appendRedPlayerActions(actions: CoreActionIntent[]): void {
    const actorId = "red-player";
    const move = this.readRedMoveDirection();
    actions.push({
      action: "move",
      phase: "held",
      actorId,
      direction: move,
      magnitude: Math.hypot(move.x, move.y),
    });
    actions.push({
      action: "aim",
      phase: "held",
      actorId,
      direction: move,
    });
    const jumpHeld = this.keys.redJump.isDown;
    if (jumpHeld && !this.redJumpWasHeld) {
      actions.push({ action: "jump", phase: "pressed", actorId });
    }
    if (jumpHeld) {
      actions.push({ action: "jump", phase: "held", actorId });
    }
    if (!jumpHeld && this.redJumpWasHeld) {
      actions.push({ action: "jump", phase: "released", actorId });
    }
    if (this.keys.redFire.isDown) {
      actions.push({ action: "firePrimary", phase: "held", actorId });
    }
  }

  private readRedMoveDirection(): WorldPosition {
    const x = Number(this.keys.redRight.isDown) -
      Number(this.keys.redLeft.isDown);
    const y = Number(this.keys.redDown.isDown) -
      Number(this.keys.redUp.isDown);
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }
}
