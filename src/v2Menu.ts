interface V2MenuElements {
  readonly root: HTMLElement;
  readonly mode: HTMLSelectElement;
  readonly map: HTMLSelectElement;
  readonly players: HTMLSelectElement;
  readonly controls: HTMLSelectElement;
  readonly play: HTMLButtonElement;
}

export function showGameplayV2Menu(): void {
  const elements = readMenuElements();
  document.documentElement.style.setProperty(
    "--v2-menu-floor",
    `url("${import.meta.env.BASE_URL}assets/ruins/floor-stone.png")`,
  );
  elements.root.classList.remove("is-hidden");
  elements.players.addEventListener("change", () => {
    const localMatch = elements.players.value === "local";
    if (localMatch) {
      elements.controls.value = "keyboard";
    }
    elements.controls.disabled = localMatch;
  });
  elements.play.addEventListener("click", () => {
    const params = new URLSearchParams();
    params.set("scene", "v2");
    params.set("mode", elements.mode.value);
    params.set("map", elements.map.value);
    params.set("players", elements.players.value);
    params.set("controls", elements.controls.value);
    window.location.search = params.toString();
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
