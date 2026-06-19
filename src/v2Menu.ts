import {
  buildV2MatchSearch,
  buildV2MenuSearch,
  readV2Route,
  type V2ControlsMode,
  type V2PlayerSkinId,
  type V2RouteConfig,
  type V2PlayersMode,
} from "./v2Route";

interface V2MenuElements {
  readonly root: HTMLElement;
  readonly home: HTMLElement;
  readonly setup: HTMLElement;
  readonly status: HTMLElement;
  readonly enterSetup: HTMLButtonElement;
  readonly back: HTMLButtonElement;
  readonly mode: HTMLSelectElement;
  readonly map: HTMLSelectElement;
  readonly players: HTMLSelectElement;
  readonly teamSize: HTMLSelectElement;
  readonly controls: HTMLSelectElement;
  readonly skin: HTMLSelectElement;
  readonly sfx: HTMLSelectElement;
  readonly start: HTMLButtonElement;
}

interface V2PauseElements {
  readonly root: HTMLElement;
  readonly resume: HTMLButtonElement;
  readonly restart: HTMLButtonElement;
  readonly mainMenu: HTMLButtonElement;
}

interface V2ResultElements {
  readonly root: HTMLElement;
  readonly title: HTMLElement;
  readonly detail: HTMLElement;
  readonly playAgain: HTMLButtonElement;
  readonly mainMenu: HTMLButtonElement;
}

export function showGameplayV2Menu(statusMessage?: string): void {
  const elements = readMenuElements();
  const route = readV2Route();
  document.documentElement.style.setProperty(
    "--v2-menu-floor",
    `url("${import.meta.env.BASE_URL}assets/ruins/floor-stone.png")`,
  );
  elements.mode.value = route.mode;
  elements.map.value = route.map;
  elements.players.value = route.players;
  elements.teamSize.value = String(route.teamSize);
  elements.controls.value = route.controls;
  elements.skin.value = route.skin;
  elements.sfx.value = route.sfx;
  elements.status.textContent = statusMessage ?? "";
  elements.status.classList.toggle("is-hidden", !statusMessage);
  elements.root.classList.remove("is-hidden");
  hideGameplayV2Pause();
  hideGameplayV2Result();
  const syncControls = (): void => {
    const localMatch = elements.players.value === "local";
    if (localMatch) {
      elements.controls.value = "keyboard";
    }
    elements.controls.disabled = localMatch;
  };
  elements.home.classList.toggle("is-hidden", Boolean(statusMessage));
  elements.setup.classList.toggle("is-hidden", !statusMessage);
  syncControls();
  elements.players.onchange = syncControls;
  elements.enterSetup.onclick = () => {
    elements.home.classList.add("is-hidden");
    elements.setup.classList.remove("is-hidden");
  };
  elements.back.onclick = () => {
    elements.setup.classList.add("is-hidden");
    elements.home.classList.remove("is-hidden");
    elements.status.classList.add("is-hidden");
  };
  elements.start.onclick = () => {
    window.location.search = buildV2MatchSearch({
      mode: elements.mode.value as typeof route.mode,
      map: elements.map.value,
      players: elements.players.value as V2PlayersMode,
      teamSize: Number(elements.teamSize.value) as typeof route.teamSize,
      controls: elements.controls.value as V2ControlsMode,
      skin: elements.skin.value as V2PlayerSkinId,
      sfx: elements.sfx.value === "off" ? "off" : "on",
    });
  };
}

export function hideGameplayV2Menu(): void {
  readMenuElements().root.classList.add("is-hidden");
}

export function showGameplayV2Pause(actions: {
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onMainMenu: () => void;
}): void {
  hideGameplayV2Result();
  const elements = readPauseElements();
  elements.resume.onclick = actions.onResume;
  elements.restart.onclick = actions.onRestart;
  elements.mainMenu.onclick = actions.onMainMenu;
  elements.root.classList.remove("is-hidden");
}

export function hideGameplayV2Pause(): void {
  readPauseElements().root.classList.add("is-hidden");
}

export function showGameplayV2Result(input: {
  readonly headline: string;
  readonly detail: string;
  readonly onPlayAgain: () => void;
  readonly onMainMenu: () => void;
}): void {
  hideGameplayV2Pause();
  const elements = readResultElements();
  elements.title.textContent = input.headline;
  elements.detail.textContent = input.detail;
  elements.playAgain.onclick = input.onPlayAgain;
  elements.mainMenu.onclick = input.onMainMenu;
  elements.root.classList.remove("is-hidden");
}

export function hideGameplayV2Result(): void {
  readResultElements().root.classList.add("is-hidden");
}

export function goToGameplayV2Menu(route: Partial<V2RouteConfig> = {}): void {
  window.location.search = buildV2MenuSearch(route);
}

function readMenuElements(): V2MenuElements {
  const root = requiredElement<HTMLElement>("v2-main-menu");
  return {
    root,
    home: requiredElement<HTMLElement>("v2-menu-home"),
    setup: requiredElement<HTMLElement>("v2-menu-setup"),
    status: requiredElement<HTMLElement>("v2-menu-status"),
    enterSetup: requiredElement<HTMLButtonElement>("v2-menu-play"),
    back: requiredElement<HTMLButtonElement>("v2-menu-back"),
    mode: requiredElement<HTMLSelectElement>("v2-menu-mode"),
    map: requiredElement<HTMLSelectElement>("v2-menu-map"),
    players: requiredElement<HTMLSelectElement>("v2-menu-players"),
    teamSize: requiredElement<HTMLSelectElement>("v2-menu-team-size"),
    controls: requiredElement<HTMLSelectElement>("v2-menu-controls"),
    skin: requiredElement<HTMLSelectElement>("v2-menu-skin"),
    sfx: requiredElement<HTMLSelectElement>("v2-menu-sfx"),
    start: requiredElement<HTMLButtonElement>("v2-menu-start"),
  };
}

function readPauseElements(): V2PauseElements {
  return {
    root: requiredElement<HTMLElement>("v2-pause-overlay"),
    resume: requiredElement<HTMLButtonElement>("v2-pause-resume"),
    restart: requiredElement<HTMLButtonElement>("v2-pause-restart"),
    mainMenu: requiredElement<HTMLButtonElement>("v2-pause-main-menu"),
  };
}

function readResultElements(): V2ResultElements {
  return {
    root: requiredElement<HTMLElement>("v2-result-overlay"),
    title: requiredElement<HTMLElement>("v2-result-title"),
    detail: requiredElement<HTMLElement>("v2-result-detail"),
    playAgain: requiredElement<HTMLButtonElement>("v2-result-play-again"),
    mainMenu: requiredElement<HTMLButtonElement>("v2-result-main-menu"),
  };
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing V2 menu element: ${id}`);
  }
  return element as T;
}
