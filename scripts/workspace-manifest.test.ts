import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { readManifest, workspaceDependencies, workspacePackages } from "./workspace-manifest.ts";

let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "self-engine-manifest-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writePackage(dir: string, manifest: object): void {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, "package.json"), JSON.stringify(manifest));
}

describe("readManifest", () => {
  it("reads both dependency fields", () => {
    writePackage("packages/a", {
      name: "@self-engine/a",
      exports: { ".": "./src/index.ts" },
      dependencies: { "@self-engine/b": "workspace:*" },
      devDependencies: { "vite-plus": "catalog:" },
    });
    expect(readManifest(join(root, "packages/a"))).toEqual({
      name: "@self-engine/a",
      exports: { ".": "./src/index.ts" },
      dependencies: { "@self-engine/b": "workspace:*" },
      devDependencies: { "vite-plus": "catalog:" },
    });
  });

  it("treats absent fields as empty", () => {
    writePackage("packages/a", {});
    expect(readManifest(join(root, "packages/a"))).toEqual({
      name: "",
      exports: undefined,
      dependencies: {},
      devDependencies: {},
    });
  });
});

describe("workspaceDependencies", () => {
  const manifest = {
    name: "@self-engine/a",
    exports: undefined,
    dependencies: { "@self-engine/c": "workspace:*", "left-pad": "1.0.0" },
    devDependencies: { "@self-engine/b": "workspace:^", "vite-plus": "catalog:" },
  };

  it("lists the workspace: dependencies, sorted", () => {
    expect(workspaceDependencies(manifest, { dev: false })).toEqual(["@self-engine/c"]);
  });

  it("adds the workspace: devDependencies on request", () => {
    expect(workspaceDependencies(manifest, { dev: true })).toEqual([
      "@self-engine/b",
      "@self-engine/c",
    ]);
  });
});

describe("workspacePackages", () => {
  it("lists apps and packages with a package.json, sorted, and skips other folders", () => {
    writePackage("packages/b", { name: "@self-engine/b" });
    writePackage("apps/desktop", { name: "@self-engine/desktop" });
    writePackage("scripts", { name: "not-a-workspace-package" });
    mkdirSync(join(root, "packages/empty"), { recursive: true });
    expect(workspacePackages(root).map(({ dir, manifest }) => [dir, manifest.name])).toEqual([
      ["apps/desktop", "@self-engine/desktop"],
      ["packages/b", "@self-engine/b"],
    ]);
  });

  it("returns nothing for a root without workspace folders", () => {
    expect(workspacePackages(root)).toEqual([]);
  });
});
