export interface SceneSelectionLocation {
  readonly pathname: string;
  readonly search: string;
}

export function shouldUseGameplayV2Shell(
  locationLike: SceneSelectionLocation,
  baseUrl = "/",
): boolean {
  const search = new URLSearchParams(locationLike.search);
  const explicitScene = search.get("scene");
  if (explicitScene === "v2") {
    return true;
  }
  if (explicitScene === "v1") {
    return false;
  }
  return isCtfTwoPagesPath(locationLike.pathname) || normalizeBasePath(baseUrl) === "/CTF-2.0/";
}

function isCtfTwoPagesPath(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  return normalizedPath === "/ctf-2.0" || normalizedPath.startsWith("/ctf-2.0/");
}

function normalizeBasePath(baseUrl: string): string {
  const withLeadingSlash = baseUrl.startsWith("/")
    ? baseUrl
    : `/${baseUrl}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}
