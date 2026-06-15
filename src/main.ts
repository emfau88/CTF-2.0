import Phaser from "phaser";
import { GameplayV2Scene } from "./adapters/phaser";
import {
  getWorldMap,
  validateWorldMapForMode,
} from "./core";
import { ArenaScene } from "./scenes/ArenaScene";
import { showGameplayV2Menu } from "./v2Menu";
import {
  buildV2MatchSearch,
  buildV2MenuSearch,
  readV2RouteState,
} from "./v2Route";

const search = new URLSearchParams(window.location.search);
const useGameplayV2Shell = search.get("scene") === "v2";
const routeState = useGameplayV2Shell ? readV2RouteState(search) : null;
const activeRoute = routeState ? { ...routeState.route } : null;
const routeIssues = routeState ? [...routeState.issues] : [];
if (useGameplayV2Shell && activeRoute && routeState?.canStartMatch) {
  const map = getWorldMap(activeRoute.map);
  if (!map) {
    routeIssues.push(`Unknown V2 arena map: ${activeRoute.map}.`);
    activeRoute.menu = true;
  } else {
    for (const issue of validateWorldMapForMode(map, modeIdForRoute(activeRoute.mode))) {
      routeIssues.push(issue.message);
    }
    if (routeIssues.length > 0) {
      activeRoute.menu = true;
    }
  }
}
const showV2Menu = useGameplayV2Shell &&
  Boolean(activeRoute?.menu || routeIssues.length > 0);

if (useGameplayV2Shell) {
  document.querySelector<HTMLElement>("#hud")?.setAttribute("hidden", "");
}

if (showV2Menu) {
  showGameplayV2Menu(routeIssues[0]);
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

function modeIdForRoute(mode: "tdm" | "ctf" | "one-flag") {
  return mode === "tdm"
    ? "team-deathmatch"
    : mode === "ctf"
    ? "classic-ctf"
    : "one-flag";
}
