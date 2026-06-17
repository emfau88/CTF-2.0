import Phaser from "phaser";
import { preloadArenaAssets } from "../../../assets";
import { readV2Route } from "../../../v2Route";
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
  AugmentedInputAdapter,
  type InputAdapterPort,
} from "../../input";
import {
  PhaserDiagnosticInputAdapter,
} from "../PhaserDiagnosticInputAdapter";
import { PhaserArenaAudioPort } from "../PhaserArenaAudioPort";
import { PhaserArenaRendererPort } from "../PhaserArenaRendererPort";
import { PhaserGameBridge } from "../PhaserGameBridge";
import { PhaserMobileInputAdapter } from "../PhaserMobileInputAdapter";
import { PhaserArenaHudPort } from "../PhaserArenaHudPort";
import { PhaserWeaponEffectsPort } from "../PhaserWeaponEffectsPort";

export class GameplayV2Scene extends Phaser.Scene {
  private bridge?: PhaserGameBridge;
  private inputAdapter?: InputAdapterPort;
  private menuKey?: Phaser.Input.Keyboard.Key;
  private pauseForVisibility = false;
  private pauseForOverlay = false;
  private skipNextFrame = false;
  private lastReportedMatchSignature = "";

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
    const selectedMap = resolveWorldMap(route.map);
    // Product V2 routes only resolve arena modes via readV2Route().
    const useMobileControls = prefersMobileControls(route);
    const useBotOpponent = prefersBotOpponent(route.players, useMobileControls);
    this.sound.mute = route.sfx === "off";
    const runtime = new GameplayCoreRuntime({
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
    });
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
            return {
              ammo: actor.weapons.rocketAmmo,
              cooldownMs: actor.weapons.rocketCooldownMs,
            };
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
    const hud = new PhaserArenaHudPort(
      this,
      useMobileControls,
      useBotOpponent,
      () => mobileInput?.requestRestart(),
    );
    const playerInput = useMobileControls && mobileInput
      ? mobileInput
      : new PhaserDiagnosticInputAdapter(
        this,
        useBotOpponent ? "tdm-solo" : "tdm",
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
      renderer: new PhaserArenaRendererPort(
        this,
        selectedMap,
        useMobileControls ? "blue-player" : undefined,
        route.skin,
      ),
      audio: new PhaserArenaAudioPort(this, "blue-player"),
      diagnostics: hud,
      effects: new PhaserWeaponEffectsPort(this, "blue-player"),
      hud,
    });
    this.bridge.initialize();
    this.publishMatchState();
    window.addEventListener("v2-sfx-changed", this.handleSfxChanged);
    window.addEventListener("v2-overlay-state", this.handleOverlayState);
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );

    if (this.input.keyboard) {
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
    if (this.pauseForVisibility || this.pauseForOverlay || document.hidden) {
      return;
    }
    if (this.menuKey && Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      window.dispatchEvent(new CustomEvent("v2-request-pause"));
      return;
    }
    if (this.skipNextFrame) {
      this.skipNextFrame = false;
      this.inputAdapter.reset();
      return;
    }
    this.bridge.advance(this.inputAdapter.readFrame(delta));
    this.publishMatchState();
  }

  private shutdown(): void {
    window.removeEventListener("v2-sfx-changed", this.handleSfxChanged);
    window.removeEventListener("v2-overlay-state", this.handleOverlayState);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.bridge?.dispose();
    this.inputAdapter?.dispose();
    this.menuKey?.destroy();
    this.bridge = undefined;
    this.inputAdapter = undefined;
    this.menuKey = undefined;
    this.pauseForVisibility = false;
    this.pauseForOverlay = false;
    this.skipNextFrame = false;
    this.lastReportedMatchSignature = "";
  }

  private readonly handleSfxChanged = (event: Event): void => {
    const enabled = Boolean(
      (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled,
    );
    this.sound.mute = !enabled;
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.pauseForVisibility = true;
      this.skipNextFrame = true;
      this.inputAdapter?.reset();
      return;
    }
    this.pauseForVisibility = false;
    this.skipNextFrame = true;
  };

  private readonly handleOverlayState = (event: Event): void => {
    this.pauseForOverlay = Boolean(
      (event as CustomEvent<{ paused?: boolean }>).detail?.paused,
    );
    if (this.pauseForOverlay) {
      this.inputAdapter?.reset();
    }
  };

  private publishMatchState(): void {
    const hudState = this.bridge?.hudState;
    if (!hudState) {
      return;
    }
    const resultKey = hudState.matchResult?.kind === "winner"
      ? `${hudState.matchResult.kind}:${hudState.matchResult.winnerEntryId}`
      : hudState.matchResult?.kind ?? "none";
    const signature = `${hudState.phase}:${resultKey}`;
    if (signature === this.lastReportedMatchSignature) {
      return;
    }
    this.lastReportedMatchSignature = signature;
    window.dispatchEvent(new CustomEvent("v2-match-state", {
      detail: {
        phase: hudState.phase,
        result: hudState.matchResult ?? null,
        scores: hudState.scores,
      },
    }));
  }
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
