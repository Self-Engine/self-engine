// Playwright's npm package holds no browser. The `stories` stage of `pnpm verify` depends on
// this script; Playwright's install returns at once when the headless shell is already there.
// Deliberately not a postinstall: `pnpm test` and everyone who never renders a story must not
// download 100 MB for it. CI calls this script with `--with-deps`, for Ubuntu's system libraries.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

export const COMPONENT_CATALOG_DIR = resolve(import.meta.dirname, "../apps/component-catalog");

/** The CLI of the `playwright` package that `componentCatalogDir` depends on. */
export function playwrightCli(componentCatalogDir: string): string {
  const require = createRequire(join(componentCatalogDir, "package.json"));
  return join(dirname(require.resolve("playwright/package.json")), "cli.js");
}

/** Downloads the Chromium headless shell if it is missing. `extraFlags` go to Playwright's install. */
export function ensureChromium(
  componentCatalogDir: string,
  extraFlags: readonly string[] = [],
  run: (cli: string, args: readonly string[]) => void = (cli, args) => {
    execFileSync(process.execPath, [cli, ...args], { stdio: "inherit" });
  },
): void {
  run(playwrightCli(componentCatalogDir), ["install", "--only-shell", "chromium", ...extraFlags]);
}

if (import.meta.main) ensureChromium(COMPONENT_CATALOG_DIR, process.argv.slice(2));
