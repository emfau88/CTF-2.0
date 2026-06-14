import {
  buildV2MatchSearch,
  readV2Route,
  type V2ControlsMode,
  type V2PlayersMode,
} from "./v2Route";

interface V2MenuElements {
  readonly root: HTMLElement;
  readonly mode: HTMLSelectElement;
  readonly map: HTMLSelectElement;
  readonly players: HTMLSelectElement;
  readonly controls: HTMLSelectElement;
  readonly sfx: HTMLSelectElement;
  readonly play: HTMLButtonElement;
}

export function showGameplayV2Menu(): void {
  const elements = readMenuElements();
  const route = readV2Route();
  document.documentElement.style.setProperty(
    "--v2-menu-floor",
    `url("${import.meta.env.BASE_URL}assets/ruins/floor-stone.png")`,
  );
  elements.mode.value = route.mode;
  elements.map.value = route.map;
  elements.players.value = route.players;
  elements.controls.value = route.controls;
  elements.sfx.value = route.sfx;
  elements.root.classList.remove("is-hidden");
  const syncControls = (): void => {
    const localMatch = elements.players.value === "local";
    if (localMatch) {
      elements.controls.value = "keyboard";
    }
    elements.controls.disabled = localMatch;
  };
  syncControls();
  elements.players.addEventListener("change", syncControls);
  elements.play.addEventListener("click", () => {
    window.location.search = buildV2MatchSearch({
      mode: elements.mode.value as typeof route.mode,
      map: elements.map.value,
      players: elements.players.value as V2PlayersMode,
      controls: elements.controls.value as V2ControlsMode,
      sfx: elements.sfx.value === "off" ? "off" : "on",
    });
  });
}

function readMenuElements(): V2MenuElements {
  const root = requiredElement<HTMLElement>("v2-main-menu");
  return {
    root,
    mode: requiredElement<HTMLSelectElement>("v2-menu-mode"),
    map: requiredElement<HTMLSelectElement>("v2-menu-map"),
    players: requiredElement<HTMLSelectElement>("v2-menu-players"),
    controls: requiredElement<HTMLSelectElement>("v2-menu-controls"),
    sfx: requiredElement<HTMLSelectElement>("v2-menu-sfx"),
    play: requiredElement<HTMLButtonElement>("v2-menu-play"),
  };
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing V2 menu element: ${id}`);
  }
  return element as T;
}
