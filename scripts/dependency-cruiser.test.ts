// The module boundary rules in .dependency-cruiser.ts (ADR 0006), run by dependency-cruiser
// on fixture workspaces built from the two placeholder packages. The allowed import lives in
// the real `packages/placeholder-module`; every forbidden one exists only in a fixture here.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { ALLOWED_IMPORTS } from "../.dependency-cruiser.ts";
import {
  cruiseFixture,
  type FixturePackage,
  repoPackage,
  ruleNames,
  withFiles,
} from "./testing/cruise-fixture.ts";

const shared = repoPackage("packages/placeholder-shared");
const module_ = repoPackage("packages/placeholder-module");

/** A package of its own, outside ALLOWED_IMPORTS. */
function extraPackage(dir: string, files: Record<string, string> = {}): FixturePackage {
  return { dir, files: { "src/index.ts": "export const value = 1;\n", ...files } };
}

function declaring(fixture: FixturePackage, ...dependencies: string[]): FixturePackage {
  return { ...fixture, dependencies: [...(fixture.dependencies ?? []), ...dependencies] };
}

describe("the placeholder packages", () => {
  it("pass as they are: placeholder-module imports placeholder-shared, an allowed direction", async () => {
    expect(module_.files["src/index.ts"]).toContain('from "@self-engine/placeholder-shared"');
    expect(await cruiseFixture([shared, module_])).toEqual([]);
  });
});

describe("package directions", () => {
  it("fail the reverse import: placeholder-shared may not import placeholder-module", async () => {
    const reverse = withFiles(declaring(shared, "@self-engine/placeholder-module"), {
      "src/reverse.ts": 'import { describeDuration } from "@self-engine/placeholder-module";\n',
    });
    expect(await cruiseFixture([reverse, module_])).toEqual([
      {
        rule: "package-direction:unlisted",
        from: "packages/placeholder-shared/src/reverse.ts",
        to: "packages/placeholder-module/src/index.ts",
      },
    ]);
  });

  it("fail a type-only import in a forbidden direction too", async () => {
    const reverse = withFiles(declaring(shared, "@self-engine/placeholder-module"), {
      "src/reverse.ts":
        'import type { describeDuration } from "@self-engine/placeholder-module";\n',
    });
    expect(ruleNames(await cruiseFixture([reverse, module_]))).toEqual([
      "package-direction:unlisted",
    ]);
  });

  it("fail a listed package importing a package outside its list", async () => {
    const other = extraPackage("packages/other");
    const sideways = withFiles(declaring(module_, "@self-engine/other"), {
      "src/sideways.ts": 'import { value } from "@self-engine/other";\n',
    });
    expect(ruleNames(await cruiseFixture([shared, sideways, other]))).toEqual([
      "package-direction:placeholder-module",
    ]);
  });

  it("fail an unlisted package importing any other workspace package", async () => {
    const newcomer = declaring(
      extraPackage("packages/newcomer", {
        "src/uses-shared.ts": 'import { formatMinutes } from "@self-engine/placeholder-shared";\n',
      }),
      "@self-engine/placeholder-shared",
    );
    expect(ruleNames(await cruiseFixture([shared, newcomer]))).toEqual([
      "package-direction:unlisted",
    ]);
  });
});

describe("the exports field", () => {
  it("fails a deep import of a path that exports does not list", async () => {
    const deep = withFiles(module_, {
      "src/deep.ts": 'import { padTwo } from "@self-engine/placeholder-shared/src/internal.ts";\n',
    });
    expect(await cruiseFixture([shared, deep])).toEqual([
      {
        rule: "not-to-unresolvable",
        from: "packages/placeholder-module/src/deep.ts",
        to: "@self-engine/placeholder-shared/src/internal.ts",
      },
    ]);
  });

  it("passes a subpath that exports does list", async () => {
    const exported = {
      ...shared,
      exports: { ".": "./src/index.ts", "./internal": "./src/internal.ts" },
    };
    const subpath = withFiles(module_, {
      "src/subpath.ts": 'import { padTwo } from "@self-engine/placeholder-shared/internal";\n',
    });
    expect(await cruiseFixture([exported, subpath])).toEqual([]);
  });

  it("fails a relative import into another package, which skips its exports", async () => {
    const relative = withFiles(module_, {
      "src/relative.ts": 'import { padTwo } from "../../placeholder-shared/src/internal.ts";\n',
    });
    expect(ruleNames(await cruiseFixture([shared, relative]))).toEqual([
      "no-relative-import-across-packages",
    ]);
  });

  it("fails a relative import out of the package into repo scripts", async () => {
    const script = { dir: "scripts", files: { "tool.ts": "export const tool = 1;\n" } };
    const outward = withFiles(shared, { "src/outward.ts": 'import "../../../scripts/tool.ts";\n' });
    expect(ruleNames(await cruiseFixture([outward, script]))).toEqual([
      "no-relative-import-across-packages",
    ]);
  });
});

describe("declared dependencies", () => {
  it("fail an import of a workspace package that package.json does not declare", async () => {
    // pnpm links only declared packages, so the name does not resolve.
    const undeclared = withFiles(shared, {
      "src/undeclared.ts": 'import "@self-engine/placeholder-module";\n',
    });
    expect(ruleNames(await cruiseFixture([undeclared, module_]))).toEqual(["not-to-unresolvable"]);
  });

  it("fail an npm package that only the workspace root provides", async () => {
    const undeclared = withFiles(shared, { "src/npm.ts": 'import "left-pad";\n' });
    expect(ruleNames(await cruiseFixture([undeclared], ["left-pad"]))).toEqual([
      "not-to-undeclared",
    ]);
  });

  it("pass an npm package the package declares", async () => {
    const declared = withFiles(declaring(shared, "left-pad"), {
      "src/npm.ts": 'import "left-pad";\n',
    });
    expect(await cruiseFixture([declared])).toEqual([]);
  });
});

describe("cycles", () => {
  it("fail a cycle inside a package", async () => {
    const cyclic = withFiles(shared, {
      "src/a.ts": 'import { b } from "./b.ts";\nexport const a = () => b;\n',
      "src/b.ts": 'import { a } from "./a.ts";\nexport const b = () => a;\n',
    });
    expect(ruleNames(await cruiseFixture([cyclic]))).toEqual(["no-circular"]);
  });
});

describe("apps", () => {
  const app = (name: string, files: Record<string, string> = {}): FixturePackage => ({
    dir: `apps/${name}`,
    files: { "src/index.ts": "export {};\n", ...files },
  });

  it("may import packages", async () => {
    const desktop = declaring(
      app("desktop", { "src/main.ts": 'import "@self-engine/placeholder-shared";\n' }),
      "@self-engine/placeholder-shared",
    );
    expect(await cruiseFixture([shared, desktop])).toEqual([]);
  });

  it("are never imported by a package", async () => {
    const upward = withFiles(declaring(shared, "@self-engine/desktop"), {
      "src/upward.ts": 'import "@self-engine/desktop";\n',
    });
    expect(ruleNames(await cruiseFixture([upward, app("desktop")]))).toEqual(["no-import-of-apps"]);
  });

  it("do not import each other", async () => {
    const web = declaring(
      app("web", { "src/main.ts": 'import "@self-engine/desktop";\n' }),
      "@self-engine/desktop",
    );
    expect(ruleNames(await cruiseFixture([web, app("desktop")]))).toEqual([
      "no-import-between-apps",
    ]);
  });
});

describe("ALLOWED_IMPORTS", () => {
  const packagesDir = resolve(import.meta.dirname, "../packages");
  const packages = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it("names only packages that exist", () => {
    for (const [name, allowed] of Object.entries(ALLOWED_IMPORTS)) {
      expect(packages).toContain(name);
      for (const target of allowed) expect(packages).toContain(target);
    }
  });

  it("allows every workspace dependency a package declares, so both change together", () => {
    for (const name of packages) {
      const manifest = JSON.parse(
        readFileSync(join(packagesDir, name, "package.json"), "utf8"),
      ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const declared = { ...manifest.dependencies, ...manifest.devDependencies };
      const workspaceDependencies = Object.entries(declared)
        .filter(([, version]) => version.startsWith("workspace:"))
        .map(([dependency]) => dependency.replace(/^@self-engine\//, ""));
      expect(ALLOWED_IMPORTS[name] ?? [], name).toEqual(
        expect.arrayContaining(workspaceDependencies),
      );
    }
  });
});
