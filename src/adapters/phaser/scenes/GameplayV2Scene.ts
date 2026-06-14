import Phaser from "phaser";
import { preloadArenaAssets } from "../../../assets";
import { buildV2MenuSearch, readV2Route } from "../../../v2Route";
import {
  ClassicCtfBotController,
  ClassicCtfMode,
  createClassicCtfWorldState,
  createOneFlagWorldState,
  createTeamDeathmatchWorldState,
  GameplayCoreRuntime,
  OneFlagMode,
  OneFlagBotController,
  resolveWorldMap,
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
import { PhaserArenaAudioPort } from "../PhaserArenaAudioPort";
import { PhaserArenaRendererPort } from "../PhaserArenaRendererPort";
import { PhaserGameBridge } from "../PhaserGameBridge";
import { PhaserMobileInputAdapter } from "../PhaserMobileInputAdapter";
import { PhaserArenaHudPort } from "../PhaserArenaHudPort";
import { PhaserWeaponEffectsPort } from "../PhaserWeaponEffectsPort";

export class GameplayV2Scene extends Phaser.Scene {
  private bridge?: PhaserGameBridge;
  private inputAdapter?: InputAdapterPort;
  private diagnosticText?: Phaser.GameObjects.Text;
  private menuKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super("GameplayV2Scene");
  }

  preload(): void {
    preloadArenaAssets(this);
  }

  create(): void {
    const route = readV2Route(new URLSearchParams(window.location.search));
    const isTeamDeathmatch = route.mode === "tdm";
    const isClassicCtf = route.mode === "ctf";
    const isOneFlag = route.mode === "one-flag";
    const isArenaMode = isTeamDeathmatch || isClassicCtf || isOneFlag;
    const selectedMap = resolveWorldMap(route.map);
    const useMobileControls = isArenaMode && prefersMobileControls(route);
    const useBotOpponent = isArenaMode &&
      prefersBotOpponent(route.players, useMobileControls);
    this.sound.mute = route.sfx === "off";
    const runtime = isArenaMode
      ? new GameplayCoreRuntime({
        mode: isClassicCtf
          ? new ClassicCtfMode(selectedMap)
          : isOneFlag
          ? new OneFlagMode(selectedMap)
          : new TeamDeathmatchMode(),
        createWorld: () => isClassicCtf
          ? createClassicCtfWorldState(selectedMap)
          : isOneFlag
          ? createOneFlagWorldState(selectedMap)
          : createTeamDeathmatchWorldState(selectedMap),
        basicAutoAttack: V2_BASIC_AUTOSHOOT_PARITY_CONFIG,
        allowManualPrimaryFire: false,
      })
      : new GameplayCoreRuntime();
    const mobileInput = useMobileControls
      ? new PhaserMobileInputAdapter(
        this,
        "blue-player",
        false,
        (weaponId) => {
          const actor = (this.bridge?.snapshot ?? runtime.snapshot).actors.find(
            (candidate) => candidate.id === "blue-player",
          );
          if (!actor) return { ammo: 0, cooldownMs: 0 };
          if (weaponId === "rocket") {
            return { ammo: actor.weapons.rocketAmmo, cooldownMs: 0 };
          }
          if (weaponId === "rail") {
            return {
              ammo: actor.weapons.railAmmo,
              cooldownMs: actor.weapons.railCooldownMs,
            };
          }
          return {
            ammo: actor.weapons.whipAmmo,
            cooldownMs: actor.weapons.whipCooldownMs,
          };
        },
        () => this.bridge?.snapshot ?? runtime.snapshot,
      )
      : undefined;
    const hud = isArenaMode
      ? new PhaserArenaHudPort(
        this,
        useMobileControls,
        useBotOpponent,
        () => mobileInput?.requestRestart(),
      )
      : this.createDiagnosticHud();
    const playerInput = useMobileControls && mobileInput
      ? mobileInput
      : new PhaserDiagnosticInputAdapter(
        this,
        isArenaMode
          ? useBotOpponent ? "tdm-solo" : "tdm"
          : "diagnostic",
      );
    this.inputAdapter = useBotOpponent
      ? new AugmentedInputAdapter(
        playerInput,
        () => this.bridge?.snapshot ?? runtime.snapshot,
        isClassicCtf
          ? new ClassicCtfBotController(
            "red-player",
            "attacker",
            selectedMap,
          )
          : isOneFlag
          ? new OneFlagBotController(
            "red-player",
            selectedMap,
          )
          : new TdmBotController("red-player", "blue-player"),
      )
      : playerInput;
    this.bridge = new PhaserGameBridge(runtime, {
      renderer: isArenaMode
        ? new PhaserArenaRendererPort(
          this,
          selectedMap,
          useMobileControls ? "blue-player" : undefined,
        )
        : new PhaserDiagnosticRendererPort(this),
      audio: isArenaMode
        ? new PhaserArenaAudioPort(this, "blue-player")
        : new NoopAudioPort(),
      diagnostics: hud,
      effects: isArenaMode
        ? new PhaserWeaponEffectsPort(this, "blue-player")
        : new NoopEffectsPort(),
      hud,
    });
    this.bridge.initialize();
    window.addEventListener("v2-sfx-changed", this.handleSfxChanged);

    if (!isArenaMode) {
      this.scale.on("resize", this.centerDiagnostic, this);
    } else if (this.input.keyboard) {
      this.menuKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.M,
      );
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_time: number, delta: number): void {
    if (!this.bridge || !this.inputAdapter) {
      return;
    }
    if (this.menuKey && Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      window.location.search = buildV2MenuSearch(readV2Route());
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
    window.removeEventListener("v2-sfx-changed", this.handleSfxChanged);
    this.bridge?.dispose();
    this.inputAdapter?.dispose();
    this.menuKey?.destroy();
    this.bridge = undefined;
    this.inputAdapter = undefined;
    this.diagnosticText = undefined;
    this.menuKey = undefined;
  }

  private readonly handleSfxChanged = (event: Event): void => {
    const enabled = Boolean(
      (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled,
    );
    this.sound.mute = !enabled;
  };
}

function prefersMobileControls(route: { controls: string; players: string }): boolean {
  const override = route.controls;
  if (override === "mobile" || override === "touch") {
    return true;
  }
  if (override === "desktop" || override === "keyboard") {
    return false;
  }
  if (route.players === "bot") {
    return true;
  }
  return navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;
}

function prefersBotOpponent(
  players: string,
  mobileControls: boolean,
): boolean {
  if (players === "bot") {
    return true;
  }
  if (players === "local") {
    return false;
  }
  return mobileControls;
}
