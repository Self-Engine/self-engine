import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { electronInstallScript, ensureElectron } from "./ensure-electron.ts";

describe("ensureElectron", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function fixture(): string {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "ensure-electron-")));
    const electron = join(dir, "node_modules", "electron");
    mkdirSync(electron, { recursive: true });
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(electron, "package.json"), '{"name":"electron","version":"0.0.0"}');
    return dir;
  }

  it("finds the installer of the app's own electron package", () => {
    const desktop = fixture();
    expect(electronInstallScript(desktop)).toBe(
      join(desktop, "node_modules", "electron", "install.js"),
    );
  });

  it("runs that installer", () => {
    const desktop = fixture();
    const scripts: string[] = [];
    ensureElectron(desktop, (script) => scripts.push(script));
    expect(scripts).toEqual([electronInstallScript(desktop)]);
  });
});
