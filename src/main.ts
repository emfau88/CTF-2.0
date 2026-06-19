import Phaser from "phaser";
import { GameplayV2Scene } from "./adapters/phaser";
import { shouldUseGameplayV2Shell } from "./bootSceneSelection";
import {
  getWorldMap,
  type MatchResult,
  type ScoreEntry,
  validateWorldMapForMode,
} from "./core";
import { ArenaScene } from "./scenes/ArenaScene";
import {
  goToGameplayV2Menu,
  hideGameplayV2Pause,
  hideGameplayV2Result,
  showGameplayV2Menu,
  showGameplayV2Pause,
  showGameplayV2Result,
} from "./v2Menu";
import {
  buildV2MatchSearch,
  readV2RouteState,
} from "./v2Route";

const search = new URLSearchParams(window.location.search);
const useGameplayV2Shell = shouldUseGameplayV2Shell(
  window.location,
  import.meta.env.BASE_URL,
);
const routeState = useGameplayV2Shell ? readV2RouteState(search) : null;
const activeRoute = routeState ? { ...routeState.route } : null;
const routeIssues = routeState ? [...routeState.issues] : [];
if (useGameplayV2Shell && activeRoute && routeState?.canStartMatch) {
  const map = getWorldMap(activeRoute.map);
  if (!map) {
    routeIssues.push(`Unknown V2 arena map: ${activeRoute.map}.`);
    activeRoute.menu = true;
  } else {
    for (const issue of validateWorldMapForMode(
      map,
      modeIdForRoute(activeRoute.mode),
      activeRoute.teamSize,
    )) {
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
    const setIngameButtonsVisible = (visible: boolean): void => {
      menuButton?.classList.toggle("is-hidden", !visible);
      audioButton?.classList.toggle("is-hidden", !visible);
    };
    const releaseOverlayPause = (): void => {
      window.dispatchEvent(
        new CustomEvent("v2-overlay-state", { detail: { paused: false } }),
      );
    };
    const showMenuRoute = (): void => {
      hideGameplayV2Pause();
      hideGameplayV2Result();
      releaseOverlayPause();
      if (activeRoute) {
        goToGameplayV2Menu(activeRoute);
      }
    };
    const restartCurrentMatch = (): void => {
      hideGameplayV2Pause();
      hideGameplayV2Result();
      releaseOverlayPause();
      if (activeRoute) {
        window.location.search = buildV2MatchSearch(activeRoute);
      }
    };
    const closePauseOverlay = (): void => {
      hideGameplayV2Pause();
      releaseOverlayPause();
      setIngameButtonsVisible(true);
    };
    const openPauseOverlay = (): void => {
      hideGameplayV2Result();
      window.dispatchEvent(
        new CustomEvent("v2-overlay-state", { detail: { paused: true } }),
      );
      setIngameButtonsVisible(false);
      showGameplayV2Pause({
        onResume: closePauseOverlay,
        onRestart: restartCurrentMatch,
        onMainMenu: showMenuRoute,
      });
    };
    menuButton?.classList.remove("is-hidden");
    if (menuButton && activeRoute) {
      menuButton.onclick = openPauseOverlay;
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
    window.addEventListener("v2-request-pause", openPauseOverlay);
    window.addEventListener("v2-match-state", (event) => {
      const detail = (event as CustomEvent<{
        phase?: string;
        result?: MatchResult | null;
        scores?: readonly ScoreEntry[];
      }>).detail;
      if (detail.phase !== "ended" || !detail.result || !activeRoute) {
        return;
      }
      setIngameButtonsVisible(false);
      hideGameplayV2Pause();
      releaseOverlayPause();
      showGameplayV2Result({
        headline: detail.result.kind === "draw"
          ? "Draw"
          : `${detail.result.winnerEntryId.toUpperCase()} Wins`,
        detail: formatResultScores(detail.scores ?? []),
        onPlayAgain: restartCurrentMatch,
        onMainMenu: showMenuRoute,
      });
    });
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

function formatResultScores(scores: readonly ScoreEntry[]): string {
  const blue = scores.find((entry) => entry.teamId === "blue")?.score ?? 0;
  const red = scores.find((entry) => entry.teamId === "red")?.score ?? 0;
  return `BLUE ${blue} : RED ${red}`;
}
