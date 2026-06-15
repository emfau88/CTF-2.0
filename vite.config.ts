import { defineConfig } from "vite";

export default defineConfig({
  base: resolveBasePath(),
});

function resolveBasePath(): string {
  const configuredBase = process.env.VITE_BASE_PATH;
  if (configuredBase) {
    return normalizeBasePath(configuredBase);
  }
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (repositoryName) {
    return `/${repositoryName}/`;
  }
  return "/CTF/";
}

function normalizeBasePath(basePath: string): string {
  const withLeadingSlash = basePath.startsWith("/")
    ? basePath
    : `/${basePath}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}
