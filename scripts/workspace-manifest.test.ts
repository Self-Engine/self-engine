import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  packageCycles,
  readManifest,
  type WorkspacePackage,
  workspaceDependencies,
  workspacePackages,
} from "./workspace-manifest.ts";

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

describe("packageCycles", () => {
  /** A package `name` whose manifest declares `dependencies` and `devDependencies`. */
  function pkg(
    name: string,
    dependencies: readonly string[] = [],
    devDependencies: readonly string[] = [],
  ): WorkspacePackage {
    const declare = (names: readonly string[]) =>
      Object.fromEntries(names.map((dependency) => [`@self-engine/${dependency}`, "workspace:*"]));
    return {
      dir: `packages/${name}`,
      manifest: {
        name: `@self-engine/${name}`,
        exports: {},
        dependencies: { zod: "catalog:", ...declare(dependencies) },
        devDependencies: declare(devDependencies),
      },
    };
  }

  it("finds none where every package depends only on packages below it", () => {
    expect(packageCycles([pkg("a", ["b"]), pkg("b", ["c"]), pkg("c")])).toEqual([]);
  });

  it("names the packages of a cycle through dependencies", () => {
    const cycle = [
      pkg("contracts", ["module"]),
      pkg("module", ["client"]),
      pkg("client", ["contracts"]),
    ];
    expect(packageCycles([...cycle, pkg("other", ["client"])])).toEqual([
      ["@self-engine/client", "@self-engine/contracts", "@self-engine/module"],
    ]);
  });

  it("counts a devDependency, which pnpm links like a dependency", () => {
    expect(packageCycles([pkg("process", ["module"]), pkg("module", [], ["process"])])).toEqual([
      ["@self-engine/module", "@self-engine/process"],
    ]);
  });

  it("names each cycle once, and a package that depends on itself", () => {
    expect(
      packageCycles([
        pkg("a", ["b"]),
        pkg("b", ["a"]),
        pkg("c", ["d"]),
        pkg("d", ["c"]),
        pkg("e", ["e"]),
      ]),
    ).toEqual([
      ["@self-engine/a", "@self-engine/b"],
      ["@self-engine/c", "@self-engine/d"],
      ["@self-engine/e"],
    ]);
  });
});
