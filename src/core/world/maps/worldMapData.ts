import type { WorldPosition } from "../../actors";
import type { PickupType } from "../../pickups";
import type { SpawnPoint } from "../../spawning";
import type { WorldGeometry } from "../worldGeometry";
import type { WorldNavigation } from "../worldNavigation";

export type WorldMapTheme = "ruins" | "library" | "industrial";
export type WorldMapWallVisual =
  | "stone-wall"
  | "bookshelf"
  | "bookshelf-damaged"
  | "reading-table"
  | "industrial-barrier";
export type WorldMapGapVisual =
  | "chasm"
  | "collapsed-floor"
  | "maintenance-pit";
export type WorldMapDecorationKind =
  | "rug"
  | "book-pile"
  | "reading-lamp"
  | "cobweb-spider"
  | "field-marking"
  | "ruins-column"
  | "ruins-overgrowth"
  | "ruins-banner-red"
  | "ruins-banner-blue"
  | "industrial-energy-red"
  | "industrial-energy-blue"
  | "industrial-switch-gate"
  | "industrial-edge-pipes"
  | "industrial-edge-tank"
  | "industrial-edge-turbine";

export interface WorldMapPresentationRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WorldMapWallPresentation extends WorldMapPresentationRect {
  readonly visual?: WorldMapWallVisual;
}

export interface WorldMapGapPresentation extends WorldMapPresentationRect {
  readonly visual?: WorldMapGapVisual;
}

export interface WorldMapDecoration extends WorldMapPresentationRect {
  readonly kind: WorldMapDecorationKind;
}

export interface WorldMapGameplay {
  readonly redBase: WorldMapPresentationRect;
  readonly blueBase: WorldMapPresentationRect;
  readonly combatZone?: WorldMapPresentationRect;
}

export interface WorldMapPresentation {
  readonly theme: WorldMapTheme;
  readonly plan: string;
  readonly walls: readonly WorldMapWallPresentation[];
  readonly gaps: readonly WorldMapGapPresentation[];
  readonly decorations?: readonly WorldMapDecoration[];
  readonly botRoutes: {
    readonly attacker: readonly WorldPosition[];
    readonly defender: readonly WorldPosition[];
  };
}

export interface WorldMapPickupSpawn {
  readonly id: string;
  readonly type: PickupType;
  readonly position: WorldPosition;
}

export interface WorldMapData {
  readonly id: string;
  readonly displayName: string;
  readonly geometry: WorldGeometry;
  readonly navigation: WorldNavigation;
  readonly spawnPoints: readonly SpawnPoint[];
  readonly pickupSpawns: readonly WorldMapPickupSpawn[];
  readonly gameplay: WorldMapGameplay;
  readonly presentation: WorldMapPresentation;
  readonly diagnosticSpawn: WorldPosition;
}

export interface WorldMapInfo {
  readonly id: string;
  readonly displayName: string;
}
