import Phaser from "phaser";
import { InertCoreRuntime } from "../../../core";
import {
  NoopAudioPort,
  NoopEffectsPort,
} from "../../noop";
import { PhaserDiagnosticHudPort } from "../PhaserDiagnosticHudPort";
import {
  PhaserDiagnosticInputAdapter,
} from "../PhaserDiagnosticInputAdapter";
import {
  PhaserDiagnosticRendererPort,
} from "../PhaserDiagnosticRendererPort";
import { PhaserGameBridge } from "../PhaserGameBridge";

export class GameplayV2Scene extends Phaser.Scene {
  private bridge?: PhaserGameBridge;
  private inputAdapter?: PhaserDiagnosticInputAdapter;
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
        fontSize: "11px",
        color: "#17302d",
        align: "center",
        lineSpacing: 0,
      },
    ).setOrigin(.5).setScrollFactor(0).setDepth(1000);

    const diagnosticHud = new PhaserDiagnosticHudPort(this.diagnosticText);
    this.inputAdapter = new PhaserDiagnosticInputAdapter(this);
    this.bridge = new PhaserGameBridge(new InertCoreRuntime(), {
      renderer: new PhaserDiagnosticRendererPort(this),
      audio: new NoopAudioPort(),
      diagnostics: diagnosticHud,
      effects: new NoopEffectsPort(),
      hud: diagnosticHud,
    });
    this.bridge.initialize();

    this.scale.on("resize", this.centerDiagnostic, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_time: number, delta: number): void {
    if (!this.bridge || !this.inputAdapter) {
      return;
    }
    this.bridge.advance(this.inputAdapter.readFrame(delta));
  }

  private centerDiagnostic(gameSize: Phaser.Structs.Size): void {
    this.diagnosticText?.setPosition(gameSize.width / 2, gameSize.height / 2);
  }

  private shutdown(): void {
    this.scale.off("resize", this.centerDiagnostic, this);
    this.bridge?.dispose();
    this.inputAdapter?.dispose();
    this.bridge = undefined;
    this.inputAdapter = undefined;
    this.diagnosticText = undefined;
  }
}
