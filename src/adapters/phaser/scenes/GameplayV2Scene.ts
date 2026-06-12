import Phaser from "phaser";
import { preloadArenaAssets } from "../../../assets";
import {
  createTeamDeathmatchWorldState,
  GameplayCoreRuntime,
  TeamDeathmatchMode,
  TdmBotController,
  V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
} from "../../../core";
import {
  NoopAudioPort,
  NoopEffectsPort,
} from "../../noop";
import {
  AugmentedInputAdapter,
  type InputAdapterPort,
} from "../../input";
import { PhaserDiagnosticHudPort } from "../PhaserDiagnosticHudPort";
import {
  PhaserDiagnosticInputAdapter,
} from "../PhaserDiagnosticInputAdapter";
import {
  PhaserDiagnosticRendererPort,
} from "../PhaserDiagnosticRendererPort";
import { PhaserArenaRendererPort } from "../PhaserArenaRendererPort";
import { PhaserGameBridge } from "../PhaserGameBridge";
import { PhaserMobileInputAdapter } from "../PhaserMobileInputAdapter";
import { PhaserTeamDeathmatchHudPort } from "../PhaserTeamDeathmatchHudPort";

export class GameplayV2Scene extends Phaser.Scene {
  private bridge?: PhaserGameBridge;
  private inputAdapter?: InputAdapterPort;
  private diagnosticText?: Phaser.GameObjects.Text;

  constructor() {
    super("GameplayV2Scene");
  }

  preload(): void {
    preloadArenaAssets(this);
  }

  create(): void {
    const isTeamDeathmatch = new URLSearchParams(window.location.search)
      .get("mode") === "tdm";
    const useMobileControls = isTeamDeathmatch && prefersMobileControls();
    const mobileInput = useMobileControls
      ? new PhaserMobileInputAdapter(this, "blue-player", false)
      : undefined;
    const hud = isTeamDeathmatch
      ? new PhaserTeamDeathmatchHudPort(
        this,
        useMobileControls,
        () => mobileInput?.requestRestart(),
      )
      : this.createDiagnosticHud();
    const runtime = isTeamDeathmatch
      ? new GameplayCoreRuntime({
        mode: new TeamDeathmatchMode(),
        createWorld: createTeamDeathmatchWorldState,
        basicAutoAttack: V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
        allowManualPrimaryFire: false,
      })
      : new GameplayCoreRuntime();
    this.inputAdapter = useMobileControls && mobileInput
      ? new AugmentedInputAdapter(
        mobileInput,
        () => this.bridge?.snapshot ?? runtime.snapshot,
        new TdmBotController("red-player", "blue-player"),
      )
      : new PhaserDiagnosticInputAdapter(
        this,
        isTeamDeathmatch ? "tdm" : "diagnostic",
      );
    this.bridge = new PhaserGameBridge(runtime, {
      renderer: isTeamDeathmatch
        ? new PhaserArenaRendererPort(
          this,
          useMobileControls ? "blue-player" : undefined,
        )
        : new PhaserDiagnosticRendererPort(this),
      audio: new NoopAudioPort(),
      diagnostics: hud,
      effects: new NoopEffectsPort(),
      hud,
    });
    this.bridge.initialize();

    if (!isTeamDeathmatch) {
      this.scale.on("resize", this.centerDiagnostic, this);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_time: number, delta: number): void {
    if (!this.bridge || !this.inputAdapter) {
      return;
    }
    this.bridge.advance(this.inputAdapter.readFrame(delta));
  }

  private createDiagnosticHud(): PhaserDiagnosticHudPort {
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
    return new PhaserDiagnosticHudPort(this.diagnosticText);
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

function prefersMobileControls(): boolean {
  const override = new URLSearchParams(window.location.search).get("controls");
  if (override === "mobile") {
    return true;
  }
  if (override === "desktop") {
    return false;
  }
  return navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;
}
