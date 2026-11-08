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

  it("finds the CLI of the playwright package the Component Catalog depends on", () => {
    const componentCatalog = fixture();
    expect(playwrightCli(componentCatalog)).toBe(join(componentCatalog, "node_modules", "playwright", "cli.js"));
  });

  it("asks that CLI for the headless shell only, the one browser the stories use", () => {
    const componentCatalog = fixture();
    const calls: (readonly string[])[] = [];
    ensureChromium(componentCatalog, [], (cli, args) => calls.push([cli, ...args]));
    expect(calls).toEqual([[playwrightCli(componentCatalog), "install", "--only-shell", "chromium"]]);
  });

  it("passes on extra flags, so CI can add Ubuntu's system libraries to the same install", () => {
    const componentCatalog = fixture();
    const calls: (readonly string[])[] = [];
    ensureChromium(componentCatalog, ["--with-deps"], (cli, args) => calls.push([cli, ...args]));
    expect(calls).toEqual([
      [playwrightCli(componentCatalog), "install", "--only-shell", "chromium", "--with-deps"],
    ]);
  });
});
