// The module boundary rules in .dependency-cruiser.ts (ADR 0006), run by dependency-cruiser on
// fixture workspaces built here. The fixtures carry their own ALLOWED_IMPORTS, so they do not
// depend on any real package; the last block checks the real repo's lists and manifests.

import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import boundaryRules, { ALLOWED_IMPORTS, TEST_ONLY_IMPORTS } from "../.dependency-cruiser.ts";
import {
  cruiseFixture,
  type FixturePackage,
  ruleNames,
  withFiles,
} from "./testing/cruise-fixture.ts";
import { packageCycles, workspaceDependencies, workspacePackages } from "./workspace-manifest.ts";

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

  it("pass a devDependency imported by a story file", async () => {
    const tool = extraPackage("packages/tool");
    const desktop = {
      ...app("desktop", { "src/main.stories.tsx": 'import "@self-engine/tool";\n' }),
      devDependencies: ["@self-engine/tool"],
    };
    expect(await cruise([tool, desktop])).toEqual([]);
  });

  it("fail a workspace package a story file imports without declaring it at all", async () => {
    const tool = extraPackage("packages/tool");
    const desktop = app("desktop", { "src/main.stories.tsx": 'import "@self-engine/tool";\n' });
    expect(
      ruleNames(await cruise([tool, desktop], { rootDependencies: ["@self-engine/tool"] })),
    ).toEqual(["declared-workspace-dependency:apps/desktop:dev-only"]);
  });

  it("fail a devDependency imported by a source file", async () => {
    const tool = extraPackage("packages/tool");
    const web = {
      ...app("web", { "src/main.ts": 'import "@self-engine/tool";\n' }),
      devDependencies: ["@self-engine/tool"],
    };
    expect(ruleNames(await cruise([tool, web]))).toEqual([
      "declared-workspace-dependency:apps/web",
    ]);
  });

  it("pass a devDependency imported by a source file of the desktop app, which bundles it", async () => {
    // electron-builder ships `dependencies` as node_modules beside the bundles, so the desktop
    // app declares there only what its bundles leave out, like the native SQLite module.
    const tool = extraPackage("packages/tool");
    const desktop = {
      ...app("desktop", { "src/main.ts": 'import "@self-engine/tool";\n' }),
      devDependencies: ["@self-engine/tool"],
    };
    expect(await cruise([tool, desktop])).toEqual([]);
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

describe("the translation core", () => {
  const i18n = (dependencies: string[], files: Record<string, string>): FixturePackage => ({
    dir: "packages/i18n",
    dependencies,
    exports: { ".": "./src/core/index.ts", "./react": "./src/react/index.ts" },
    files: { "src/react/index.ts": "export const provider = 1;\n", ...files },
  });

  it.each(["react", "@lingui/react"])("fails an import of %s", async (name) => {
    const found = await cruise([i18n([name], { "src/core/index.ts": `import "${name}";\n` })]);
    expect(ruleNames(found)).toEqual(["i18n-core-is-pure"]);
  });

  it("fails an import of the React entry point", async () => {
    const found = await cruise([
      i18n([], { "src/core/index.ts": 'import "../react/index.ts";\n' }),
    ]);
    expect(ruleNames(found)).toEqual(["i18n-core-is-pure"]);
  });

  it("passes those imports in the React entry point", async () => {
    const found = await cruise([
      i18n(["react"], {
        "src/core/index.ts": "export const core = 1;\n",
        "src/react/index.ts": 'import "react";\nimport "../core/index.ts";\n',
      }),
    ]);
    expect(found).toEqual([]);
  });
});

describe("the time package", () => {
  it("imports no other workspace package, even as a type", async () => {
    const time = declaring(
      extraPackage("packages/time", {
        "src/index.ts": 'import type { formatMinutes } from "@self-engine/shared";\n',
      }),
      "@self-engine/shared",
    );
    expect(ruleNames(await cruise([time, shared], { allowedImports: ALLOWED_IMPORTS }))).toEqual([
      "package-direction:time",
    ]);
  });

  it("can be imported by a module contract", async () => {
    const time = extraPackage("packages/time");
    const module = declaring(
      extraPackage("packages/module", {
        "src/contracts/index.ts": 'import "@self-engine/time";\n',
      }),
      "@self-engine/time",
    );
    expect(
      await cruise([time, module], { allowedImports: { time: [], module: ["time"] } }),
    ).toEqual([]);
  });
});

describe("the db core", () => {
  const db = (dependencies: string[], files: Record<string, string>): FixturePackage => ({
    dir: "packages/db",
    dependencies,
    exports: { ".": "./src/core/index.ts", "./better-sqlite3": "./src/better-sqlite3/index.ts" },
    files: { "src/better-sqlite3/index.ts": "export const open = 1;\n", ...files },
  });

  it("fails an import of the native driver", async () => {
    const found = await cruise([
      db(["better-sqlite3"], { "src/core/index.ts": 'import "better-sqlite3";\n' }),
    ]);
    expect(ruleNames(found)).toEqual(["db-core-is-pure"]);
  });

  it("fails an import of the driver entry point", async () => {
    const found = await cruise([
      db([], { "src/core/index.ts": 'import "../better-sqlite3/index.ts";\n' }),
    ]);
    expect(ruleNames(found)).toEqual(["db-core-is-pure"]);
  });

  it("passes the driver in its entry point", async () => {
    const found = await cruise([
      db(["better-sqlite3"], {
        "src/core/index.ts": "export const core = 1;\n",
        "src/better-sqlite3/index.ts": 'import "better-sqlite3";\nimport "../core/index.ts";\n',
      }),
    ]);
    expect(found).toEqual([]);
  });
});

describe("the db schema entry", () => {
  const schema: FixturePackage = {
    dir: "packages/db",
    dependencies: ["zod"],
    exports: { ".": "./src/core/index.ts", "./schema": "./src/schema/index.ts" },
    files: {
      "src/core/index.ts": "export {};\n",
      "src/schema/index.ts": 'import "zod";\n',
      "src/better-sqlite3/index.ts": "export {};\n",
    },
  };

  it.each(["kysely", "uuid", "better-sqlite3"])("fails an import of %s", async (name) => {
    const found = await cruise([
      withFiles(declaring(schema, name), { "src/schema/index.ts": `import "${name}";\n` }),
    ]);
    expect(ruleNames(found)).toEqual(["db-schema-is-pure"]);
  });

  it.each(["core", "better-sqlite3"])("fails a relative import of the %s entry", async (entry) => {
    const found = await cruise([
      withFiles(schema, { "src/schema/index.ts": `import "../${entry}/index.ts";\n` }),
    ]);
    expect(ruleNames(found)).toEqual(["db-schema-is-pure"]);
  });

  it.each(["@self-engine/db", "@self-engine/db/better-sqlite3"])(
    "fails %s in a module's contracts even when the package direction is allowed",
    async (entry) => {
      const database = {
        ...schema,
        exports: { ...schema.exports, "./better-sqlite3": "./src/better-sqlite3/index.ts" },
      };
      const module = declaring(
        extraPackage("packages/module", {
          "src/contracts/index.ts": `import "${entry}";\n`,
        }),
        "@self-engine/db",
      );
      const found = await cruise([database, module], { allowedImports: { module: ["db"] } });
      expect(ruleNames(found)).toEqual(["module-contracts-is-pure"]);
    },
  );

  it("fails a relative import from a module's contracts into its runtime code", async () => {
    const module = extraPackage("packages/module", {
      "src/data/index.ts": "export const data = 1;\n",
      "src/contracts/index.ts": 'import "../data/index.ts";\n',
    });
    expect(ruleNames(await cruise([module]))).toEqual(["module-contracts-is-pure"]);
  });

  it("passes a relative import within a module's contracts", async () => {
    const module = extraPackage("packages/module", {
      "src/contracts/schemas.ts": "export const schema = 1;\n",
      "src/contracts/index.ts": 'import "./schemas.ts";\n',
    });
    expect(await cruise([module])).toEqual([]);
  });

  it("passes Zod in the schema entry and the schema in a module's contracts", async () => {
    const module = {
      ...extraPackage("packages/module", {
        "src/contracts/index.ts": 'import "@self-engine/db/schema";\n',
      }),
      dependencies: ["@self-engine/db"],
    };
    expect(await cruise([schema, module], { allowedImports: { module: ["db"] } })).toEqual([]);
  });
});

describe("the settings core", () => {
  const settings = (dependencies: string[], files: Record<string, string>): FixturePackage => ({
    dir: "packages/settings",
    dependencies,
    exports: { ".": "./src/core/index.ts", "./react": "./src/react/index.ts" },
    files: { "src/react/index.ts": "export const hook = 1;\n", ...files },
  });

  it.each(["react", "react-dom"])("fails an import of %s", async (name) => {
    const found = await cruise([settings([name], { "src/core/index.ts": `import "${name}";\n` })]);
    expect(ruleNames(found)).toEqual(["settings-core-is-pure"]);
  });

  it("fails an import of the React binding", async () => {
    const found = await cruise([
      settings([], { "src/core/index.ts": 'import "../react/index.ts";\n' }),
    ]);
    expect(ruleNames(found)).toEqual(["settings-core-is-pure"]);
  });

  it("passes those imports in the React binding", async () => {
    const found = await cruise([
      settings(["react"], {
        "src/core/index.ts": "export const core = 1;\n",
        "src/react/index.ts": 'import "react";\nimport "../core/index.ts";\n',
      }),
    ]);
    expect(found).toEqual([]);
  });
});

describe("the hotkey library", () => {
  const RULE = "hotkeys-only-through-bindings";
  const shell = (library: string, file: string): FixturePackage => ({
    dir: "packages/shell",
    dependencies: [library],
    files: { [file]: `import "${library}";\n` },
  });

  describe.each(["@tanstack/react-hotkeys", "@tanstack/hotkeys"])("%s", (library) => {
    it("passes an import in the binding file", async () => {
      expect(await cruise([shell(library, "src/shortcut-bindings.tsx")])).toEqual([]);
    });

    it("fails an import in another file of the same package", async () => {
      expect(ruleNames(await cruise([shell(library, "src/other.tsx")]))).toEqual([RULE]);
    });

    it("fails an import from another package", async () => {
      const importing = withFiles(declaring(shared, library), {
        "src/keys.ts": `import "${library}";\n`,
      });
      expect(ruleNames(await cruise([importing]))).toEqual([RULE]);
    });
  });
});

describe("the query library", () => {
  const RULE = "query-library-only-through-building-block";
  const dataClient = (library: string, file: string): FixturePackage => ({
    dir: "packages/data-client",
    dependencies: [library],
    files: { [file]: `import "${library}";\n` },
  });

  describe.each(["@tanstack/react-query", "@tanstack/query-core"])("%s", (library) => {
    it("passes an import in the building block", async () => {
      expect(await cruise([dataClient(library, "src/react/query-hook.ts")])).toEqual([]);
    });

    it("fails an import in another file of the data client", async () => {
      expect(ruleNames(await cruise([dataClient(library, "src/data-connection.ts")]))).toEqual([
        RULE,
      ]);
    });

    it("fails an import in a module", async () => {
      const importing = withFiles(declaring(module_, library), {
        "src/notes.ts": `import "${library}";\n`,
      });
      expect(ruleNames(await cruise([shared, importing]))).toEqual([RULE]);
    });

    it("fails an import in an app", async () => {
      const web = declaring(app("web", { "src/main.ts": `import "${library}";\n` }), library);
      expect(ruleNames(await cruise([web]))).toEqual([RULE]);
    });
  });
});

describe("testing entries", () => {
  const RULE = "testing-entries-only-in-tests-and-stories";
  /** The shared package with a `./testing` entry, as `@self-engine/data-client/testing`. */
  const withTesting: FixturePackage = {
    ...withFiles(shared, { "src/testing/index.ts": "export const fixed = 1;\n" }),
    exports: { ".": "./src/index.ts", "./testing": "./src/testing/index.ts" },
  };
  const importing = (file: string) =>
    withFiles(module_, {
      [file]: 'import "@self-engine/shared/testing";\n',
    });

  it.each(["src/notes.test.ts", "src/notes.stories.tsx", "src/testing/helpers.ts"])(
    "passes an import in %s",
    async (file) => {
      expect(await cruise([withTesting, importing(file)])).toEqual([]);
    },
  );

  it("fails an import in a module's code", async () => {
    expect(ruleNames(await cruise([withTesting, importing("src/notes-view.tsx")]))).toEqual([RULE]);
  });

  it("fails an import in an app's code", async () => {
    const web = declaring(
      app("web", { "src/main.ts": 'import "@self-engine/shared/testing";\n' }),
      "@self-engine/shared",
    );
    expect(ruleNames(await cruise([withTesting, web]))).toEqual([RULE]);
  });

  it("fails an import of the package's own testing folder from its code", async () => {
    const own = withFiles(withTesting, { "src/index.ts": 'import "./testing/index.ts";\n' });
    expect(ruleNames(await cruise([own]))).toEqual([RULE]);
  });
});

describe("icon libraries", () => {
  const RULE = "icons-only-through-catalog";

  describe.each([
    "@phosphor-icons/react",
    "phosphor-react-native",
    "@tabler/icons-react",
    "lucide-react",
    "react-icons",
  ])("%s", (library) => {
    it("fails an import from an app", async () => {
      const desktop = declaring(
        app("desktop", { "src/main.ts": `import "${library}";\n` }),
        library,
      );
      expect(await cruise([desktop])).toEqual([
        {
          rule: RULE,
          from: "apps/desktop/src/main.ts",
          to: `node_modules/${library}/dist/index.js`,
        },
      ]);
    });

    it("fails an import from a package outside the icon package", async () => {
      const importing = withFiles(declaring(shared, library), {
        "src/icon.ts": `import "${library}";\n`,
      });
      expect(ruleNames(await cruise([importing]))).toEqual([RULE]);
    });

    it("fails a type-only import outside the icon package", async () => {
      const importing = withFiles(declaring(shared, library), {
        "src/icon.ts": `import type { Icon } from "${library}";\n`,
      });
      expect(ruleNames(await cruise([importing]))).toEqual([RULE]);
    });

    it("fails an import the importer has not installed, and names the catalog there too", async () => {
      const importing = withFiles(shared, { "src/icon.ts": `import "${library}";\n` });
      expect(ruleNames(await cruise([importing]))).toEqual([RULE, "not-to-unresolvable"]);
    });

    it("passes an import inside the icon package", async () => {
      const icons: FixturePackage = {
        dir: "packages/icons",
        dependencies: [library],
        files: {
          "src/index.ts": `import "${library}";\n`,
          "src/types.ts": `import type { Icon } from "${library}";\n`,
        },
      };
      expect(await cruise([icons])).toEqual([]);
    });
  });

  it("fails a per-icon entry point", async () => {
    const importing = withFiles(shared, {
      "src/icon.ts": 'import "@phosphor-icons/react/dist/csr/Folders";\n',
    });
    expect(ruleNames(await cruise([importing]))).toEqual([RULE, "not-to-unresolvable"]);
  });

  it("does not exempt a package whose name only starts like the icon package", async () => {
    const lookalike = declaring(
      extraPackage("packages/icons-extra", { "src/icon.ts": 'import "lucide-react";\n' }),
      "lucide-react",
    );
    expect(ruleNames(await cruise([lookalike]))).toEqual([RULE]);
  });

  it("passes a library whose name only starts like a listed one", async () => {
    const importing = withFiles(declaring(shared, "lucide-react-extras"), {
      "src/icon.ts": 'import "lucide-react-extras";\n',
    });
    expect(await cruise([importing])).toEqual([]);
  });

  it("names the catalog package in the rule's message", () => {
    const rule = boundaryRules.forbidden?.find(({ name }) => name === RULE);
    expect(rule?.comment).toContain("@self-engine/icons");
  });
});

describe("the app contract", () => {
  const contracts = (dependencies: string[], files: Record<string, string>): FixturePackage => ({
    dir: "packages/contracts",
    dependencies: ["zod", "@orpc/contract", ...dependencies],
    files: {
      "src/index.ts": 'import "zod";\nimport "@orpc/contract";\nexport const appContract = {};\n',
      ...files,
    },
  });

  it("passes Zod and the oRPC contract library", async () => {
    expect(await cruise([contracts([], {})])).toEqual([]);
  });

  it.each(["kysely", "better-sqlite3", "electron"])("fails an import of %s", async (name) => {
    const found = await cruise([contracts([name], { "src/extra.ts": `import "${name}";\n` })]);
    expect(ruleNames(found)).toEqual(["contracts-is-pure"]);
  });

  it("fails an import of a Node built-in", async () => {
    const found = await cruise([contracts([], { "src/extra.ts": 'import "node:fs";\n' })]);
    expect(ruleNames(found)).toEqual(["contracts-is-pure"]);
  });

  it("fails an import of the database package", async () => {
    const db = extraPackage("packages/db");
    const found = await cruise([
      db,
      contracts(["@self-engine/db"], { "src/extra.ts": 'import "@self-engine/db";\n' }),
    ]);
    expect(ruleNames(found)).toEqual(["package-direction:unlisted"]);
  });
});

describe("the renderer", () => {
  const contracts: FixturePackage = {
    dir: "packages/contracts",
    files: { "src/index.ts": "export const appContract = {};\nexport type AppContract = {};\n" },
  };
  const dataProcess: FixturePackage = {
    dir: "packages/data-process",
    exports: { ".": "./src/core/index.ts", "./testing": "./src/testing/index.ts" },
    files: {
      "src/core/index.ts": "export const startDataProcess = 1;\n",
      "src/testing/index.ts": "export const startTestDataProcess = 1;\n",
    },
  };
  const db: FixturePackage = {
    dir: "packages/db",
    exports: { ".": "./src/core/index.ts", "./better-sqlite3": "./src/better-sqlite3/index.ts" },
    files: {
      "src/core/index.ts": "export const core = 1;\n",
      "src/better-sqlite3/index.ts": "export const openDatabase = 1;\n",
    },
  };
  const time: FixturePackage = {
    dir: "packages/time",
    exports: { ".": "./src/index.ts", "./data": "./src/data/index.ts" },
    files: {
      "src/index.ts": "export const views = 1;\n",
      "src/data/index.ts": "export const storage = 1;\n",
    },
  };
  const renderers = [
    (files: Record<string, string>) => app("web", files),
    (files: Record<string, string>) => app("component-catalog", files),
    (files: Record<string, string>) => extraPackage("packages/data-client", files),
  ];
  const ALLOW = { "data-client": ["contracts", "data-process", "db", "time"] };

  it.each(renderers.map((make) => [make({}).dir, make] as const))(
    "%s imports the app contract as a type",
    async (_, make) => {
      const renderer = declaring(
        make({ "src/client.ts": 'import type { AppContract } from "@self-engine/contracts";\n' }),
        "@self-engine/contracts",
      );
      expect(await cruise([contracts, renderer], { allowedImports: ALLOW })).toEqual([]);
    },
  );

  it.each(renderers.map((make) => [make({}).dir, make] as const))(
    "%s fails a value import of the app contract",
    async (_, make) => {
      const renderer = declaring(
        make({ "src/client.ts": 'import { appContract } from "@self-engine/contracts";\n' }),
        "@self-engine/contracts",
      );
      expect(ruleNames(await cruise([contracts, renderer], { allowedImports: ALLOW }))).toEqual([
        "renderer-imports-the-contract-as-a-type",
      ]);
    },
  );

  it("fails a value import of the protocol, which loads its schemas too", async () => {
    const protocol: FixturePackage = {
      dir: "packages/data-protocol",
      files: { "src/index.ts": "export const protocolContract = {};\n" },
    };
    const client = declaring(
      extraPackage("packages/data-client", {
        "src/client.ts": 'import { protocolContract } from "@self-engine/data-protocol";\n',
      }),
      "@self-engine/data-protocol",
    );
    const allow = { "data-client": ["data-protocol"] };
    expect(ruleNames(await cruise([protocol, client], { allowedImports: allow }))).toEqual([
      "renderer-imports-the-contract-as-a-type",
    ]);
  });

  it.each([
    ["the data process core", "@self-engine/data-process", []],
    // A testing entry outside tests and stories breaks a second rule.
    [
      "the data process test harness",
      "@self-engine/data-process/testing",
      ["testing-entries-only-in-tests-and-stories"],
    ],
    ["the database connection", "@self-engine/db/better-sqlite3", []],
    ["a module's ./data entry", "@self-engine/time/data", []],
  ])("fails an import of %s", async (_, specifier, alsoBroken) => {
    const packageName = specifier.split("/").slice(0, 2).join("/");
    for (const make of renderers) {
      const renderer = declaring(make({ "src/data.ts": `import "${specifier}";\n` }), packageName);
      const found = await cruise([dataProcess, db, time, renderer], { allowedImports: ALLOW });
      expect(ruleNames(found), renderer.dir).toEqual([
        "renderer-stays-off-the-database",
        ...alsoBroken,
      ]);
    }
  });

  it("passes the data process test harness in the data client's tests", async () => {
    const client = {
      ...extraPackage("packages/data-client", {
        "src/client.test.ts": 'import "@self-engine/data-process/testing";\n',
      }),
      devDependencies: ["@self-engine/data-process"],
    };
    expect(await cruise([dataProcess, client], { allowedImports: ALLOW })).toEqual([]);
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

  it("has no cycle between packages, devDependencies included (ADR 0006)", () => {
    expect(packageCycles(packages)).toEqual([]);
  });

  it("allows exactly the workspace dependencies each package declares, so both change together", () => {
    for (const { dir, manifest } of packages.filter(({ dir }) => dir.startsWith("packages/"))) {
      const name = dir.slice("packages/".length);
      const declared = workspaceDependencies(manifest, { dev: true }).map((dependency) =>
        dependency.replace(/^@self-engine\//, ""),
      );
      const allowed = [...(ALLOWED_IMPORTS[name] ?? []), ...(TEST_ONLY_IMPORTS[name] ?? [])];
      expect(allowed.sort(), name).toEqual(declared);
    }
  });
});

describe("the storage package", () => {
  it("may import db and time", async () => {
    const storage = declaring(
      extraPackage("packages/storage", {
        "src/index.ts": 'import "@self-engine/db";\nimport "@self-engine/time";\n',
      }),
      "@self-engine/db",
      "@self-engine/time",
    );
    expect(
      await cruise([storage, extraPackage("packages/db"), extraPackage("packages/time")], {
        allowedImports: ALLOWED_IMPORTS,
      }),
    ).toEqual([]);
  });
  it.each(["contracts", "data-process", "shared"])("cannot import %s", async (target) => {
    const storage = declaring(
      extraPackage("packages/storage", {
        "src/index.ts": `import "@self-engine/${target}";\n`,
      }),
      `@self-engine/${target}`,
    );
    expect(
      ruleNames(
        await cruise([storage, extraPackage(`packages/${target}`)], {
          allowedImports: ALLOWED_IMPORTS,
        }),
      ),
    ).toEqual(["package-direction:storage"]);
  });
  it.each(["electron", "better-sqlite3"])(
    "cannot import %s, including in testing",
    async (dependency) => {
      const storage = declaring(
        extraPackage("packages/storage", {
          "src/testing/index.ts": `import "${dependency}";\n`,
        }),
        dependency,
      );
      expect(ruleNames(await cruise([storage], { allowedImports: ALLOWED_IMPORTS }))).toEqual([
        "storage-is-portable",
      ]);
    },
  );
});

describe("data-side module composition", () => {
  it("allows data-process to import storage", async () => {
    const process = declaring(
      extraPackage("packages/data-process", {
        "src/index.ts": 'import "@self-engine/storage";\n',
      }),
      "@self-engine/storage",
    );
    expect(
      await cruise([process, extraPackage("packages/storage")], {
        allowedImports: ALLOWED_IMPORTS,
      }),
    ).toEqual([]);
  });
  it("rejects a module importing data-process even if it declares the dependency", async () => {
    const module = declaring(
      extraPackage("packages/placeholder-alpha", {
        "src/data/index.ts": 'import "@self-engine/data-process";\n',
      }),
      "@self-engine/data-process",
    );
    expect(
      ruleNames(
        await cruise([module, extraPackage("packages/data-process")], {
          allowedImports: ALLOWED_IMPORTS,
        }),
      ),
    ).toEqual(["package-direction:placeholder-alpha"]);
  });
  it("lets a module's tests import the test Data Process, and only its tests", async () => {
    const module = declaring(
      extraPackage("packages/placeholder-alpha", {
        "src/port.test.ts": 'import "@self-engine/data-process";\n',
      }),
      "@self-engine/data-process",
    );
    const options = { allowedImports: ALLOWED_IMPORTS, testOnlyImports: TEST_ONLY_IMPORTS };
    expect(await cruise([module, extraPackage("packages/data-process")], options)).toEqual([]);
    const fromCode = declaring(
      extraPackage("packages/placeholder-alpha", {
        "src/port.ts": 'import "@self-engine/data-process";\n',
      }),
      "@self-engine/data-process",
    );
    expect(
      ruleNames(await cruise([fromCode, extraPackage("packages/data-process")], options)),
    ).toEqual(["package-direction:placeholder-alpha"]);
  });
  it.each(["src/react/provider.test.tsx", "src/react/provider.stories.tsx"])(
    "lets the data client's %s import the test Data Process, as its other tests may",
    async (file) => {
      const client = declaring(
        extraPackage("packages/data-client", { [file]: 'import "@self-engine/data-process";\n' }),
        "@self-engine/data-process",
      );
      expect(
        await cruise([client, extraPackage("packages/data-process")], {
          allowedImports: ALLOWED_IMPORTS,
          testOnlyImports: TEST_ONLY_IMPORTS,
        }),
      ).toEqual([]);
    },
  );
});

describe("the system clock entry", () => {
  const time: FixturePackage = {
    dir: "packages/time",
    exports: { ".": "./src/index.ts", "./system-clock": "./src/system-clock.ts" },
    files: {
      "src/index.ts": "export {};",
      "src/system-clock.ts": "export const systemClock = () => '';",
    },
  };
  it.each(["src/index.ts", "src/clock.test.ts", "src/clock.stories.tsx"])(
    "rejects a package import in %s",
    async (file) => {
      const consumer = declaring(
        extraPackage("packages/consumer", {
          [file]: 'import { systemClock } from "@self-engine/time/system-clock";',
        }),
        "@self-engine/time",
      );
      expect(
        ruleNames(
          await cruise([time, consumer], { allowedImports: { time: [], consumer: ["time"] } }),
        ),
      ).toEqual(["system-clock-only-in-apps"]);
    },
  );
  it("rejects loading the public system clock entry even from time itself", async () => {
    const ownImport = withFiles(time, {
      "src/clock.test.ts": 'import { systemClock } from "@self-engine/time/system-clock";',
    });
    expect(ruleNames(await cruise([ownImport], { allowedImports: { time: [] } }))).toEqual([
      "system-clock-only-in-apps",
    ]);
  });
  it("allows app assembly and internal clock tests", async () => {
    const desktop = declaring(
      app("desktop", {
        "src/main.ts": 'import { systemClock } from "@self-engine/time/system-clock";',
      }),
      "@self-engine/time",
    );
    const testedTime = withFiles(time, {
      "src/clock.test.ts": 'import { systemClock } from "./system-clock.ts";',
    });
    expect(await cruise([testedTime, desktop], { allowedImports: { time: [] } })).toEqual([]);
  });
});
