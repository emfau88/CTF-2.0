export type V2ModeId = "tdm" | "ctf" | "one-flag";
export type V2PlayersMode = "bot" | "local";
export type V2ControlsMode = "auto" | "touch" | "keyboard";
export type V2SfxMode = "on" | "off";
export type V2PlayerSkinId = "alien-runner" | "riot-droid";

export interface V2RouteConfig {
  readonly scene: "v2";
  readonly mode: V2ModeId;
  readonly map: string;
  readonly players: V2PlayersMode;
  readonly controls: V2ControlsMode;
  readonly skin: V2PlayerSkinId;
  readonly sfx: V2SfxMode;
  readonly menu: boolean;
}

export interface V2RouteState {
  readonly route: V2RouteConfig;
  readonly issues: readonly string[];
  readonly canStartMatch: boolean;
}

const DEFAULT_ROUTE: V2RouteConfig = {
  scene: "v2",
  mode: "tdm",
  map: "training-crossing-v2",
  players: "bot",
  controls: "auto",
  skin: "alien-runner",
  sfx: "on",
  menu: true,
};

export function readV2RouteState(
  search: URLSearchParams = new URLSearchParams(window.location.search),
): V2RouteState {
  const hasMode = search.has("mode");
  const modeValue = search.get("mode");
  const playersValue = search.get("players");
  const controlsValue = search.get("controls");
  const skinValue = search.get("skin");
  const mapValue = search.get("map");
  const route: V2RouteConfig = {
    scene: "v2",
    mode: readMode(modeValue),
    map: mapValue ?? DEFAULT_ROUTE.map,
    players: readPlayers(playersValue),
    controls: readControls(controlsValue),
    skin: readSkin(skinValue),
    sfx: readSfx(search.get("sfx")),
    menu: search.get("menu") === "1" || !hasMode,
  };
  const issues: string[] = [];
  if (hasMode && !isMode(modeValue)) {
    issues.push(`Unsupported V2 mode: ${modeValue ?? "missing"}.`);
  }
  if (hasMode && !mapValue) {
    issues.push("Missing V2 arena map.");
  }
  if (hasMode && !isPlayersMode(playersValue)) {
    issues.push(`Unsupported V2 players mode: ${playersValue ?? "missing"}.`);
  }
  if (hasMode && !isControlsMode(controlsValue)) {
    issues.push(`Unsupported V2 controls mode: ${controlsValue ?? "missing"}.`);
  }
  if (hasMode && skinValue !== null && !isPlayerSkin(skinValue)) {
    issues.push(`Unsupported V2 player skin: ${skinValue ?? "missing"}.`);
  }
  return {
    route: {
      ...route,
      menu: route.menu || issues.length > 0,
    },
    issues,
    canStartMatch: hasMode && issues.length === 0 && route.menu === false,
  };
}

export function readV2Route(
  search: URLSearchParams = new URLSearchParams(window.location.search),
): V2RouteConfig {
  return readV2RouteState(search).route;
}

export function buildV2RouteSearch(
  config: Partial<V2RouteConfig> = {},
): string {
  const resolved = { ...DEFAULT_ROUTE, ...config };
  const params = new URLSearchParams();
  params.set("scene", "v2");
  params.set("mode", resolved.mode);
  params.set("map", resolved.map);
  params.set("players", resolved.players);
  params.set("controls", resolved.controls);
  params.set("skin", resolved.skin);
  params.set("sfx", resolved.sfx);
  if (resolved.menu) {
    params.set("menu", "1");
  }
  return params.toString();
}

export function buildV2MenuSearch(
  current: Partial<V2RouteConfig> = {},
): string {
  return buildV2RouteSearch({ ...current, menu: true });
}

export function buildV2MatchSearch(
  current: Partial<V2RouteConfig> = {},
): string {
  return buildV2RouteSearch({ ...current, menu: false });
}

function readMode(value: string | null): V2ModeId {
  return isMode(value) ? value : DEFAULT_ROUTE.mode;
}

function readPlayers(value: string | null): V2PlayersMode {
  return isPlayersMode(value) ? value : DEFAULT_ROUTE.players;
}

function readControls(value: string | null): V2ControlsMode {
  return isControlsMode(value) ? value : DEFAULT_ROUTE.controls;
}

function readSkin(value: string | null): V2PlayerSkinId {
  return isPlayerSkin(value) ? value : DEFAULT_ROUTE.skin;
}

function readSfx(value: string | null): V2SfxMode {
  return value === "off" ? "off" : "on";
}

function isMode(value: string | null): value is V2ModeId {
  return value === "ctf" || value === "one-flag" || value === "tdm";
}

function isPlayersMode(value: string | null): value is V2PlayersMode {
  return value === "local" || value === "bot";
}

function isControlsMode(value: string | null): value is V2ControlsMode {
  return value === "touch" || value === "keyboard" || value === "auto";
}

function isPlayerSkin(value: string | null): value is V2PlayerSkinId {
  return value === "alien-runner" || value === "riot-droid";
}
