import Phaser from "phaser";
import { InertCoreRuntime } from "../../../core";
import {
  NoopAudioPort,
  NoopEffectsPort,
  NoopRendererPort,
} from "../../noop";
import { PhaserDiagnosticHudPort } from "../PhaserDiagnosticHudPort";
import { PhaserGameBridge } from "../PhaserGameBridge";

export class GameplayV2Scene extends Phaser.Scene {
  private bridge?: PhaserGameBridge;
  private inputSequence = 0;
  private diagnosticText?: Phaser.GameObjects.Text;

  constructor() {
    super("GameplayV2Scene");
  }

  create(): void {
    this.diagnosticText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      "Gameplay Core V2 Shell",
      {
        fontFamily: "Consolas, monospace",
        fontSize: "24px",
        color: "#17302d",
        align: "center",
        lineSpacing: 8,
      },
    ).setOrigin(.5);

    this.bridge = new PhaserGameBridge(new InertCoreRuntime(), {
      renderer: new NoopRendererPort(),
      audio: new NoopAudioPort(),
      effects: new NoopEffectsPort(),
      hud: new PhaserDiagnosticHudPort(this.diagnosticText),
    });
    this.bridge.initialize();

    this.scale.on("resize", this.centerDiagnostic, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(time: number, delta: number): void {
    this.bridge?.advance({
      sequence: ++this.inputSequence,
      timeMs: time,
      deltaMs: Math.max(0, delta),
      actions: [],
    });
  }

  private centerDiagnostic(gameSize: Phaser.Structs.Size): void {
    this.diagnosticText?.setPosition(gameSize.width / 2, gameSize.height / 2);
  }

  private shutdown(): void {
    this.scale.off("resize", this.centerDiagnostic, this);
    this.bridge?.dispose();
    this.bridge = undefined;
    this.diagnosticText = undefined;
  }
}
