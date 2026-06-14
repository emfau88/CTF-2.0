export type V2ModeId = "tdm" | "ctf" | "one-flag";
export type V2PlayersMode = "bot" | "local";
export type V2ControlsMode = "auto" | "touch" | "keyboard";
export type V2SfxMode = "on" | "off";

export interface V2RouteConfig {
  readonly scene: "v2";
  readonly mode: V2ModeId;
  readonly map: string;
  readonly players: V2PlayersMode;
  readonly controls: V2ControlsMode;
  readonly sfx: V2SfxMode;
  readonly menu: boolean;
}

const DEFAULT_ROUTE: V2RouteConfig = {
  scene: "v2",
  mode: "tdm",
  map: "training-crossing-v2",
  players: "bot",
  controls: "auto",
  sfx: "on",
  menu: true,
};

export function readV2Route(
  search: URLSearchParams = new URLSearchParams(window.location.search),
): V2RouteConfig {
  return {
    scene: "v2",
    mode: readMode(search.get("mode")),
    map: search.get("map") ?? DEFAULT_ROUTE.map,
    players: readPlayers(search.get("players")),
    controls: readControls(search.get("controls")),
    sfx: readSfx(search.get("sfx")),
    menu: search.get("menu") === "1" || !search.has("mode"),
  };
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
  return value === "ctf" || value === "one-flag" || value === "tdm"
    ? value
    : DEFAULT_ROUTE.mode;
}

function readPlayers(value: string | null): V2PlayersMode {
  return value === "local" || value === "bot" ? value : DEFAULT_ROUTE.players;
}

function readControls(value: string | null): V2ControlsMode {
  return value === "touch" || value === "keyboard" || value === "auto"
    ? value
    : DEFAULT_ROUTE.controls;
}

function readSfx(value: string | null): V2SfxMode {
  return value === "off" ? "off" : "on";
}
