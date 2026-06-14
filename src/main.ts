import Phaser from "phaser";
import { GameplayV2Scene } from "./adapters/phaser";
import { ArenaScene } from "./scenes/ArenaScene";
import { showGameplayV2Menu } from "./v2Menu";
import {
  buildV2MatchSearch,
  buildV2MenuSearch,
  readV2Route,
} from "./v2Route";

const search = new URLSearchParams(window.location.search);
const useGameplayV2Shell = search.get("scene") === "v2";
const route = useGameplayV2Shell ? readV2Route(search) : null;
const activeRoute = route ? { ...route } : null;
const showV2Menu = useGameplayV2Shell && Boolean(activeRoute?.menu);

if (useGameplayV2Shell) {
  document.querySelector<HTMLElement>("#hud")?.setAttribute("hidden", "");
}

if (showV2Menu) {
  showGameplayV2Menu();
} else {
  if (useGameplayV2Shell) {
    const menuButton = document.querySelector<HTMLButtonElement>(
      "#v2-game-menu-button",
    );
    menuButton?.classList.remove("is-hidden");
    if (menuButton && activeRoute) {
      menuButton.onclick = () => {
        window.location.search = buildV2MenuSearch(activeRoute);
      };
    }
    const audioButton = document.querySelector<HTMLButtonElement>(
      "#v2-audio-button",
    );
    audioButton?.classList.remove("is-hidden");
    if (audioButton && activeRoute) {
      let currentSfx = activeRoute.sfx;
      const syncAudioButton = (): void => {
        audioButton.textContent = currentSfx === "off" ? "SFX OFF" : "SFX ON";
        audioButton.setAttribute(
          "aria-pressed",
          currentSfx === "off" ? "true" : "false",
        );
      };
      syncAudioButton();
      audioButton.onclick = () => {
        currentSfx = currentSfx === "off" ? "on" : "off";
        activeRoute.sfx = currentSfx;
        syncAudioButton();
        window.history.replaceState(
          null,
          "",
          `?${buildV2MatchSearch(activeRoute)}`,
        );
        window.dispatchEvent(
          new CustomEvent("v2-sfx-changed", {
            detail: { enabled: currentSfx === "on" },
          }),
        );
      };
    }
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#edf5ee",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    render: { antialias: true },
    scene: [useGameplayV2Shell ? GameplayV2Scene : ArenaScene],
  });
}
