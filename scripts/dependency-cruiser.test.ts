// The module boundary rules in .dependency-cruiser.ts (ADR 0006), run by dependency-cruiser on
// fixture workspaces built here. The fixtures carry their own ALLOWED_IMPORTS, so they do not
// depend on any real package; the last block checks the real repo's lists and manifests.

import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { ALLOWED_IMPORTS } from "../.dependency-cruiser.ts";
import {
  cruiseFixture,
  type FixturePackage,
  ruleNames,
  withFiles,
} from "./testing/cruise-fixture.ts";
import { workspaceDependencies, workspacePackages } from "./workspace-manifest.ts";

/** `packages/module` may import `packages/shared`, not the other way round. */
const ALLOWED = { module: ["shared"] };

/** A shared package whose `./internal.ts` stays private: `exports` lists only `index.ts`. */
const shared: FixturePackage = {
  dir: "packages/shared",
  files: {
    "src/index.ts":
      'import { padTwo } from "./internal.ts";\nexport const formatMinutes = (minutes: number) => padTwo(minutes);\n',
    "src/internal.ts": "export const padTwo = (value: number) => String(value).padStart(2, '0');\n",
  },
};

/** A module that imports the shared package, the allowed direction. */
const module_: FixturePackage = {
  dir: "packages/module",
  dependencies: ["@self-engine/shared"],
  files: {
    "src/index.ts":
      'import { formatMinutes } from "@self-engine/shared";\nexport const describeDuration = formatMinutes;\n',
  },
};

/** A package of its own, outside ALLOWED. */
function extraPackage(dir: string, files: Record<string, string> = {}): FixturePackage {
  return { dir, files: { "src/index.ts": "export const value = 1;\n", ...files } };
}

function app(name: string, files: Record<string, string> = {}): FixturePackage {
  return { dir: `apps/${name}`, files: { "src/index.ts": "export {};\n", ...files } };
}

function declaring(fixture: FixturePackage, ...dependencies: string[]): FixturePackage {
  return { ...fixture, dependencies: [...(fixture.dependencies ?? []), ...dependencies] };
}

function cruise(packages: readonly FixturePackage[], options = {}) {
  return cruiseFixture(packages, { allowedImports: ALLOWED, ...options });
}

describe("the fixture workspace", () => {
  it("passes as it is: module imports shared, an allowed direction", async () => {
    expect(await cruise([shared, module_])).toEqual([]);
  });
});

describe("package directions", () => {
  it("fail the reverse import: shared may not import module", async () => {
    const reverse = withFiles(declaring(shared, "@self-engine/module"), {
      "src/reverse.ts": 'import { describeDuration } from "@self-engine/module";\n',
    });
    expect(await cruise([reverse, module_])).toEqual([
      {
        rule: "package-direction:unlisted",
        from: "packages/shared/src/reverse.ts",
        to: "packages/module/src/index.ts",
      },
    ]);
  });

  it("fail a type-only import in a forbidden direction too", async () => {
    const reverse = withFiles(declaring(shared, "@self-engine/module"), {
      "src/reverse.ts": 'import type { describeDuration } from "@self-engine/module";\n',
    });
    expect(ruleNames(await cruise([reverse, module_]))).toEqual(["package-direction:unlisted"]);
  });

  it("fail a listed package importing a package outside its list", async () => {
    const other = extraPackage("packages/other");
    const sideways = withFiles(declaring(module_, "@self-engine/other"), {
      "src/sideways.ts": 'import { value } from "@self-engine/other";\n',
    });
    expect(ruleNames(await cruise([shared, sideways, other]))).toEqual([
      "package-direction:module",
    ]);
  });

  it("fail an unlisted package importing any other workspace package", async () => {
    const newcomer = declaring(
      extraPackage("packages/newcomer", {
        "src/uses-shared.ts": 'import { formatMinutes } from "@self-engine/shared";\n',
      }),
      "@self-engine/shared",
    );
    expect(ruleNames(await cruise([shared, newcomer]))).toEqual(["package-direction:unlisted"]);
  });
});

describe("the exports field", () => {
  it("fails a deep import of a path that exports does not list", async () => {
    const deep = withFiles(module_, {
      "src/deep.ts": 'import { padTwo } from "@self-engine/shared/src/internal.ts";\n',
    });
    expect(await cruise([shared, deep])).toEqual([
      {
        rule: "not-to-unresolvable",
        from: "packages/module/src/deep.ts",
        to: "@self-engine/shared/src/internal.ts",
      },
    ]);
  });

  it("passes a subpath that exports does list", async () => {
    const exported = {
      ...shared,
      exports: { ".": "./src/index.ts", "./internal": "./src/internal.ts" },
    };
    const subpath = withFiles(module_, {
      "src/subpath.ts": 'import { padTwo } from "@self-engine/shared/internal";\n',
    });
    expect(await cruise([exported, subpath])).toEqual([]);
  });

  it("passes a subpath that exports only declarations, under the types condition", async () => {
    const typed = withFiles(
      { ...shared, exports: { ".": "./src/index.ts", "./types": { types: "./src/types.d.ts" } } },
      { "src/types.d.ts": "export type Minutes = number;\n" },
    );
    const user = withFiles(module_, {
      "src/typed.ts": 'import type { Minutes } from "@self-engine/shared/types";\n',
    });
    expect(await cruise([typed, user])).toEqual([]);
  });
});

describe("relative imports", () => {
  it("fail from a package into another package, which skips its exports", async () => {
    const relative = withFiles(module_, {
      "src/relative.ts": 'import { padTwo } from "../../shared/src/internal.ts";\n',
    });
    expect(ruleNames(await cruise([shared, relative]))).toEqual([
      "no-relative-import-across-packages",
    ]);
  });

  it("fail from a package out into repo scripts", async () => {
    const script = { dir: "scripts", files: { "tool.ts": "export const tool = 1;\n" } };
    const outward = withFiles(shared, { "src/outward.ts": 'import "../../../scripts/tool.ts";\n' });
    expect(ruleNames(await cruise([outward, script]))).toEqual([
      "no-relative-import-across-packages",
    ]);
  });

  it("fail from an app into a package's internals", async () => {
    const desktop = app("desktop", {
      "src/main.ts": 'import { padTwo } from "../../../packages/shared/src/internal.ts";\n',
    });
    expect(await cruise([shared, desktop])).toEqual([
      {
        rule: "no-relative-import-across-packages",
        from: "apps/desktop/src/main.ts",
        to: "packages/shared/src/internal.ts",
      },
    ]);
  });

  it("fail from repo scripts into a package", async () => {
    const script = {
      dir: "scripts",
      files: { "tool.ts": 'import { padTwo } from "../packages/shared/src/internal.ts";\n' },
    };
    expect(await cruise([shared, script])).toEqual([
      {
        rule: "no-relative-import-into-packages",
        from: "scripts/tool.ts",
        to: "packages/shared/src/internal.ts",
      },
    ]);
  });

  it("pass a script that only builds a URL into a package, which is no import", async () => {
    const script = {
      dir: "scripts",
      files: {
        "tool.ts":
          'export const entry = new URL("../packages/shared/src/index.ts", import.meta.url);\n',
      },
    };
    expect(await cruise([shared, script])).toEqual([]);
  });
});

describe("declared dependencies", () => {
  it("fail an import of a workspace package that no package.json declares", async () => {
    // pnpm links only declared packages, so the name does not resolve.
    const undeclared = withFiles(shared, {
      "src/undeclared.ts": 'import "@self-engine/module";\n',
    });
    expect(ruleNames(await cruise([undeclared, module_]))).toEqual(["not-to-unresolvable"]);
  });

  it("fail an app importing a workspace package that only the root declares", async () => {
    // Node resolution finds it in the root node_modules, so it resolves.
    const tool = extraPackage("packages/tool");
    const desktop = app("desktop", { "src/main.ts": 'import "@self-engine/tool";\n' });
    expect(await cruise([tool, desktop], { rootDependencies: ["@self-engine/tool"] })).toEqual([
      {
        rule: "declared-workspace-dependency:apps/desktop",
        from: "apps/desktop/src/main.ts",
        to: "packages/tool/src/index.ts",
      },
    ]);
  });

  it("fail a package importing a workspace package that only the root declares", async () => {
    const tool = extraPackage("packages/tool");
    const user = withFiles(module_, { "src/tool.ts": 'import "@self-engine/tool";\n' });
    const allowedImports = { module: ["shared", "tool"] };
    expect(
      ruleNames(
        await cruise([shared, tool, user], {
          allowedImports,
          rootDependencies: ["@self-engine/tool"],
        }),
      ),
    ).toEqual(["declared-workspace-dependency:packages/module"]);
  });

  it("pass a devDependency imported by a test file", async () => {
    const tool = extraPackage("packages/tool");
    const desktop = {
      ...app("desktop", { "src/main.test.ts": 'import "@self-engine/tool";\n' }),
      devDependencies: ["@self-engine/tool"],
    };
    expect(await cruise([tool, desktop])).toEqual([]);
  });

  it("fail a devDependency imported by a source file", async () => {
    const tool = extraPackage("packages/tool");
    const desktop = {
      ...app("desktop", { "src/main.ts": 'import "@self-engine/tool";\n' }),
      devDependencies: ["@self-engine/tool"],
    };
    expect(ruleNames(await cruise([tool, desktop]))).toEqual([
      "declared-workspace-dependency:apps/desktop",
    ]);
  });

  it("fail an npm package that only the workspace root provides", async () => {
    const undeclared = withFiles(shared, { "src/npm.ts": 'import "left-pad";\n' });
    expect(ruleNames(await cruise([undeclared], { npmPackages: ["left-pad"] }))).toEqual([
      "not-to-undeclared",
    ]);
  });

  it("pass an npm package the package declares", async () => {
    const declared = withFiles(declaring(shared, "left-pad"), {
      "src/npm.ts": 'import "left-pad";\n',
    });
    expect(await cruise([declared])).toEqual([]);
  });
});

describe("cycles", () => {
  it("fail a cycle inside a package", async () => {
    const cyclic = withFiles(shared, {
      "src/a.ts": 'import { b } from "./b.ts";\nexport const a = () => b;\n',
      "src/b.ts": 'import { a } from "./a.ts";\nexport const b = () => a;\n',
    });
    expect(ruleNames(await cruise([cyclic]))).toEqual(["no-circular"]);
  });

  it("fail a cycle of type-only imports too", async () => {
    const cyclic = withFiles(shared, {
      "src/a.ts": 'import type { B } from "./b.ts";\nexport type A = { b?: B };\n',
      "src/b.ts": 'import type { A } from "./a.ts";\nexport type B = { a?: A };\n',
    });
    expect(ruleNames(await cruise([cyclic]))).toEqual(["no-circular"]);
  });
});

describe("apps", () => {
  it("may import packages they declare", async () => {
    const desktop = declaring(
      app("desktop", { "src/main.ts": 'import "@self-engine/shared";\n' }),
      "@self-engine/shared",
    );
    expect(await cruise([shared, desktop])).toEqual([]);
  });

  it("are never imported by a package", async () => {
    const upward = withFiles(declaring(shared, "@self-engine/desktop"), {
      "src/upward.ts": 'import "@self-engine/desktop";\n',
    });
    expect(ruleNames(await cruise([upward, app("desktop")]))).toEqual(["no-import-of-apps"]);
  });

  it("do not import each other", async () => {
    const web = declaring(
      app("web", { "src/main.ts": 'import "@self-engine/desktop";\n' }),
      "@self-engine/desktop",
    );
    expect(ruleNames(await cruise([web, app("desktop")]))).toEqual(["no-import-between-apps"]);
  });
});

describe("the theme core", () => {
  const theme = (dependencies: string[], files: Record<string, string>): FixturePackage => ({
    dir: "packages/theme",
    dependencies,
    exports: { ".": "./src/core/index.ts", "./mantine": "./src/mantine/index.ts" },
    files: { "src/mantine/index.ts": "export const provider = 1;\n", ...files },
  });

  it.each(["react", "react-dom", "@mantine/core"])("fails an import of %s", async (name) => {
    const found = await cruise([theme([name], { "src/core/index.ts": `import "${name}";\n` })]);
    expect(ruleNames(found)).toEqual(["theme-core-is-pure"]);
  });

  it("fails an import of the Mantine binding", async () => {
    const found = await cruise([
      theme([], { "src/core/index.ts": 'import "../mantine/index.ts";\n' }),
    ]);
    expect(ruleNames(found)).toEqual(["theme-core-is-pure"]);
  });

  it("passes those imports in the Mantine binding", async () => {
    const found = await cruise([
      theme(["react"], {
        "src/core/index.ts": "export const core = 1;\n",
        "src/mantine/index.ts": 'import "react";\nimport "../core/index.ts";\n',
      }),
    ]);
    expect(found).toEqual([]);
  });
});

describe("the repo's workspace", () => {
  const packages = workspacePackages(resolve(import.meta.dirname, ".."));
  const folders = packages
    .filter(({ dir }) => dir.startsWith("packages/"))
    .map(({ dir }) => dir.slice("packages/".length));

  it("names every package @self-engine/<folder name>, which ALLOWED_IMPORTS relies on", () => {
    for (const { dir, manifest } of packages) {
      expect(manifest.name, dir).toBe(`@self-engine/${dir.split("/")[1]}`);
    }
  });

  it("lists in ALLOWED_IMPORTS only packages that exist", () => {
    for (const [name, allowed] of Object.entries(ALLOWED_IMPORTS)) {
      expect(folders).toContain(name);
      for (const target of allowed) expect(folders).toContain(target);
    }
  });

  it("allows exactly the workspace dependencies each package declares, so both change together", () => {
    for (const { dir, manifest } of packages.filter(({ dir }) => dir.startsWith("packages/"))) {
      const name = dir.slice("packages/".length);
      const declared = workspaceDependencies(manifest, { dev: true }).map((dependency) =>
        dependency.replace(/^@self-engine\//, ""),
      );
      expect([...(ALLOWED_IMPORTS[name] ?? [])].sort(), name).toEqual(declared);
    }
  });
});
