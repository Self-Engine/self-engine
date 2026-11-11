// Module boundaries (ADR 0006), checked by `pnpm verify` (the `verify:boundaries` task in
// vite.config.ts). pnpm's isolation and the `exports` field are the first two mechanisms;
// these rules are the third: the directions allowed between packages, every workspace import
// declared in the importer's own `package.json`, no relative imports into another package, no
// imports past another package's `exports`, no icon library outside `@self-engine/icons`, no
// hotkey library outside the Shell's binding file, and no cycles.
//
// Paths are relative to the repo root, or to the fixture root in
// scripts/dependency-cruiser.test.ts, which builds its own config with `boundaryConfig`.

import type { IConfiguration, IForbiddenRuleType } from "dependency-cruiser";
import { workspaceDependencies, workspacePackages } from "./scripts/workspace-manifest.ts";

export type AllowedImports = Readonly<Record<string, readonly string[]>>;

/**
 * The workspace packages each package may import besides itself, by folder name under
 * `packages/`. A folder name is the package name without `@self-engine/` (a test enforces it).
 * A package that is missing here may import no other workspace package. Adding an edge is a
 * change here and in that package's `package.json`, so a review sees both; a test checks that
 * the two lists match.
 */
export const ALLOWED_IMPORTS: AllowedImports = {
  "data-client": ["contracts"],
  // `data-client` for its tests only, which drive the real client against the core.
  "data-process": ["contracts", "data-client", "db"],
  icons: ["theme"],
  "placeholder-alpha": ["shell", "icons", "ui"],
  "placeholder-beta": ["shell", "icons"],
  shell: ["icons", "theme", "ui"],
  ui: ["icons", "theme"],
};

/** Only `@self-engine/icons` may import these; Tabler and the rest would be a second library. */
const ICON_LIBRARIES = [
  "@phosphor-icons/react",
  "phosphor-react-native",
  "@tabler/icons-react",
  "lucide-react",
  "react-icons",
];

/**
 * The app contract and each module's `./contracts` entry, which by convention lives in
 * `src/contracts/` (D187).
 */
const CONTRACT_SOURCE = "^packages/(?:contracts/|[^/]+/src/contracts/)";

/** The only npm packages a contract may import (D187). */
const CONTRACT_LIBRARIES = "zod|@orpc/contract";

/**
 * Code that runs in the renderer and has no business near the database: the apps that render
 * the UI and the client that talks to the data process. Packages are held off by
 * ALLOWED_IMPORTS already.
 */
const RENDERER_SOURCE = "^(?:apps/(?:web|component-catalog)|packages/data-client)/";

/** Test and story files may also import what `devDependencies` declares. */
const DEV_ONLY_FILE = String.raw`\.(?:test|stories)\.[cm]?[jt]sx?$`;

function alternatives(names: readonly string[]): string {
  return names.map((name) => name.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

/** One rule per package in `allowed`: no workspace package outside its list. */
function allowedDirectionRules(allowed: AllowedImports): IForbiddenRuleType[] {
  return Object.entries(allowed).map(([name, targets]) => ({
    name: `package-direction:${name}`,
    comment: `packages/${name} may import only ${["itself", ...targets].join(", ")} (ALLOWED_IMPORTS in .dependency-cruiser.ts).`,
    severity: "error",
    from: { path: `^packages/(?:${alternatives([name])})/` },
    to: { path: "^packages/", pathNot: `^packages/(?:${alternatives([name, ...targets])})/` },
  }));
}

/**
 * Per workspace package in `rootDir`: an import of another package by name must be declared in
 * the importer's own `package.json`. Node resolution walks up to the root `node_modules`, so a
 * package that only the root declares resolves anyway, and dependency-cruiser types declared
 * and undeclared workspace imports alike (`undetermined`), which `not-to-undeclared` cannot
 * tell apart. Relative imports are left to `no-relative-import-*`.
 */
function declaredWorkspaceRules(rootDir: string): IForbiddenRuleType[] {
  const packages = workspacePackages(rootDir);
  const dirOf = new Map(packages.map(({ dir, manifest }) => [manifest.name, dir]));
  const dirsOf = (names: readonly string[]) =>
    names.flatMap((name) => {
      const dir = dirOf.get(name);
      return dir === undefined ? [] : [dir];
    });
  return packages.flatMap(({ dir, manifest }): IForbiddenRuleType[] => {
    const rule = (
      kind: string,
      from: IForbiddenRuleType["from"],
      dev: boolean,
    ): IForbiddenRuleType => ({
      name: `declared-workspace-dependency:${dir}${kind}`,
      comment: `${dir} imports a workspace package that its package.json does not declare${dev ? " (tests and stories may use devDependencies)" : " in dependencies"}.`,
      severity: "error",
      from,
      to: {
        path: "^packages/",
        pathNot: `^(?:${alternatives([dir, ...dirsOf(workspaceDependencies(manifest, { dev }))])})/`,
        dependencyTypesNot: ["local"],
      },
    });
    const prefix = `^${alternatives([dir])}/`;
    return [
      rule("", { path: prefix, pathNot: DEV_ONLY_FILE }, false),
      rule(":dev-only", { path: `${prefix}.*${DEV_ONLY_FILE}` }, true),
    ];
  });
}

interface CorePurity {
  /** The package's folder under `packages/`, which holds `src/core/`. */
  readonly folder: string;
  /** The folder under `src/` where the framework code lives instead. */
  readonly binding: string;
  /** Alternatives, as a regular expression, of the npm packages the core must not import. */
  readonly npmPattern: string;
  readonly comment: string;
}

/** The pure core of a package stays free of the framework its binding entry point wraps. */
function corePurityRule({ folder, binding, npmPattern, comment }: CorePurity): IForbiddenRuleType {
  return {
    name: `${folder}-core-is-pure`,
    comment,
    severity: "error",
    from: { path: `^packages/${folder}/src/core/` },
    to: { path: [`(^|/)node_modules/(${npmPattern})/`, `^packages/${folder}/src/${binding}/`] },
  };
}

export interface BoundaryOptions {
  /** The allowed directions between packages, see ALLOWED_IMPORTS. */
  readonly allowedImports: AllowedImports;
  /** The workspace root, whose `apps/*` and `packages/*` manifests are read. */
  readonly rootDir: string;
}

/** The boundary rules for the workspace at `rootDir`. */
export function boundaryConfig({ allowedImports, rootDir }: BoundaryOptions): IConfiguration {
  const forbidden: IForbiddenRuleType[] = [
    ...allowedDirectionRules(allowedImports),
    {
      name: "package-direction:unlisted",
      comment:
        "A package without an entry in ALLOWED_IMPORTS (.dependency-cruiser.ts) may import no other workspace package.",
      severity: "error",
      from: { path: `^packages/(?!(?:${alternatives(Object.keys(allowedImports))})/)([^/]+)/` },
      to: { path: "^packages/", pathNot: "^packages/$1/" },
    },
    ...declaredWorkspaceRules(rootDir),
    corePurityRule({
      folder: "theme",
      binding: "mantine",
      npmPattern: "react|react-dom|@mantine/[^/]+",
      comment:
        "The theme core (`@self-engine/theme`) runs without React or Mantine, so it can serve React Native and tests. Those imports belong in `@self-engine/theme/mantine`.",
    }),
    corePurityRule({
      folder: "settings",
      binding: "react",
      npmPattern: "react|react-dom",
      comment:
        "The settings core (`@self-engine/settings`) runs without React. The hook belongs in `@self-engine/settings/react`.",
    }),
    corePurityRule({
      folder: "i18n",
      binding: "react",
      npmPattern: "react|react-dom|@lingui/react",
      comment:
        "The translation core (`@self-engine/i18n`) runs without React, so it works outside a component. Those imports belong in `@self-engine/i18n/react`. Its own tsconfig keeps the DOM out.",
    }),
    corePurityRule({
      folder: "db",
      binding: "better-sqlite3",
      npmPattern: "better-sqlite3",
      comment:
        "The database core (`@self-engine/db`) is what modules import, so it stays free of the native driver and the web build keeps compiling. The driver belongs in `@self-engine/db/better-sqlite3`.",
    }),
    {
      name: "contracts-are-pure",
      comment:
        "A contract (`@self-engine/contracts`, a module's `./contracts`) is read by the data process and the renderer alike, so it holds only Zod schemas and oRPC contracts (D187). Database code, Electron and Node belong in the data process.",
      severity: "error",
      from: { path: CONTRACT_SOURCE, pathNot: DEV_ONLY_FILE },
      to: { path: "(^|/)node_modules/", pathNot: `(^|/)node_modules/(?:${CONTRACT_LIBRARIES})/` },
    },
    {
      name: "contracts-are-pure:node",
      comment:
        "A contract is read by the renderer too, where Node's modules do not exist (D187). Keep it to Zod schemas and oRPC contracts.",
      severity: "error",
      from: { path: CONTRACT_SOURCE, pathNot: DEV_ONLY_FILE },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "renderer-imports-contracts-as-types",
      comment:
        "Outside the data process the app contract is a type: `import type { AppContract }`. A value import would load every schema at startup (D187, D188); the data process checks the input.",
      severity: "error",
      from: { path: "^(apps|packages)/", pathNot: "^packages/(?:contracts|data-process)/" },
      to: { path: "^packages/contracts/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "renderer-never-reaches-the-database",
      comment:
        "Only the data process opens the database. The renderer reaches it through `@self-engine/data-client`, never through the data process core, the SQLite driver or a module's `./data` entry.",
      severity: "error",
      from: { path: RENDERER_SOURCE },
      to: {
        path: [
          "^packages/data-process/",
          "^packages/db/src/better-sqlite3/",
          "^packages/[^/]+/src/data/",
          "(^|/)node_modules/better-sqlite3/",
        ],
      },
    },
    {
      name: "icons-only-through-catalog",
      comment:
        "Icons come from the catalog: import them from `@self-engine/icons`. A missing icon is one line in that package plus one entry in the name list of its test.",
      severity: "error",
      from: { path: "^(apps|packages)/", pathNot: "^packages/icons/" },
      // The first `^` is the bare name of a library the importer has not installed, which
      // pnpm's isolation makes the usual case: the import does not resolve, and still gets
      // this hint.
      to: { path: `(^|(^|/)node_modules/)(?:${alternatives(ICON_LIBRARIES)})(/|$)` },
    },
    {
      name: "hotkeys-only-through-bindings",
      comment:
        "The hotkey library is in beta and must stay out of the startup bundle, so only the Shell's lazily loaded binding file may import it (D179). Add a binding there.",
      severity: "error",
      from: { path: "^(apps|packages)/", pathNot: "^packages/shell/src/shortcut-bindings\\.tsx$" },
      to: { path: "(^|(^|/)node_modules/)@tanstack/(?:react-)?hotkeys(/|$)" },
    },
    {
      name: "no-relative-import-across-packages",
      comment:
        "A relative import that leaves its app or package skips the other package's `exports`. Import it by its package name.",
      severity: "error",
      from: { path: "^(apps|packages)/([^/]+)/" },
      to: { dependencyTypes: ["local"], pathNot: "^$1/$2/" },
    },
    {
      name: "no-relative-import-into-packages",
      comment:
        "Repo scripts and root files reach a package by its name, not by a relative path past its `exports`.",
      severity: "error",
      from: { pathNot: "^(apps|packages)/" },
      to: { dependencyTypes: ["local"], path: "^packages/" },
    },
    {
      name: "no-import-of-apps",
      comment: "Apps sit on top: packages and repo scripts never import them.",
      severity: "error",
      from: { pathNot: "^apps/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-import-between-apps",
      comment: "Apps share code through packages, never directly.",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "not-to-unresolvable",
      comment:
        "The import does not resolve. Into a workspace package that means a path its `exports` does not list, or a package its `package.json` does not declare.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "not-to-undeclared",
      comment: "The npm package is not declared in the importing package's `package.json`.",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      // The swc parser reports type-only imports, so a cycle of `import type` edges counts
      // too: it still ties the modules together for a reader and for a later split.
      name: "no-circular",
      comment: "Modules in a cycle cannot be understood, tested or split apart on their own.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ];

  return {
    forbidden,
    options: {
      // TypeScript 7 has no JS compiler API, which dependency-cruiser's tsc parser needs. The
      // swc parser reports type-only imports, so they are checked like any other
      // (`tsPreCompilationDeps` is a tsc option and would only warn that tsc is missing).
      // It does not see type queries (`typeof import("…")`, `import("…").T`); the lint rule
      // `self-engine/no-import-type-query` (packages/oxlint-plugin) bans them instead.
      parser: "swc",
      // Imports of npm packages stay in the graph (so `not-to-undeclared` sees them), but
      // their own imports are not followed. `exclude` would drop them from the graph.
      doNotFollow: { path: "(^|/)node_modules/" },
      // Only the workspace's own build output. Anchored, because most npm packages resolve
      // into a `dist/` of their own, and rules could not see an excluded import. The empty
      // alternative stands for `?`, whose nesting dependency-cruiser refuses as a slow pattern.
      exclude: { path: "^((apps|packages)/[^/]+/|)(dist|dist-electron|dist-release|release)/" },
      enhancedResolveOptions: {
        // Resolve workspace packages through their `exports` only, so a deep import fails.
        exportsFields: ["exports"],
        // `types` as TypeScript resolves it, so a subpath that exports only declarations
        // (`"./types": { "types": "./x.d.ts" }`) resolves instead of failing as unresolvable.
        conditionNames: ["types", "import", "node", "default"],
        extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
        mainFields: ["module", "main"],
      },
    },
  };
}

export default boundaryConfig({ allowedImports: ALLOWED_IMPORTS, rootDir: import.meta.dirname });
