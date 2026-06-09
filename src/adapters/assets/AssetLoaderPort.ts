export type AssetKind =
  | "image"
  | "spritesheet"
  | "audio"
  | "data"
  | string;

export interface AssetRequest {
  readonly key: string;
  readonly kind: AssetKind;
  readonly source: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AssetLoaderPort {
  load(assets: readonly AssetRequest[]): void;
}
