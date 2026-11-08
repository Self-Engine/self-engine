import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ensureChromium, playwrightCli } from "./ensure-chromium.ts";

describe("ensureChromium", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function fixture(): string {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "ensure-chromium-")));
    const playwright = join(dir, "node_modules", "playwright");
    mkdirSync(playwright, { recursive: true });
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(playwright, "package.json"), '{"name":"playwright","version":"0.0.0"}');
    return dir;
  }

  it("finds the CLI of the catalog's own playwright package", () => {
    const catalog = fixture();
    expect(playwrightCli(catalog)).toBe(join(catalog, "node_modules", "playwright", "cli.js"));
  });

  it("asks that CLI for the headless shell only, the one browser the stories use", () => {
    const catalog = fixture();
    const calls: (readonly string[])[] = [];
    ensureChromium(catalog, (cli, args) => calls.push([cli, ...args]));
    expect(calls).toEqual([[playwrightCli(catalog), "install", "--only-shell", "chromium"]]);
  });
});
