// Electron 45 has no install script, so `pnpm install` leaves the npm package without its
// binary. `pnpm dev` and the `smoke` stage of `pnpm verify` call this before launching;
// `install.js` returns at once when the binary is already there. Deliberately not a
// postinstall: `pnpm test` and everyone who never starts the app must not download it.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

export const DESKTOP_DIR = resolve(import.meta.dirname, "../apps/desktop");

/** The `install.js` of the `electron` package that `desktopDir` depends on. */
export function electronInstallScript(desktopDir: string): string {
  const require = createRequire(join(desktopDir, "package.json"));
  return join(dirname(require.resolve("electron/package.json")), "install.js");
}

/** Downloads the Electron binary if it is missing. */
export function ensureElectron(
  desktopDir: string,
  run: (script: string) => void = (script) => {
    execFileSync(process.execPath, [script], { stdio: "inherit" });
  },
): void {
  run(electronInstallScript(desktopDir));
}

if (import.meta.main) ensureElectron(DESKTOP_DIR);
