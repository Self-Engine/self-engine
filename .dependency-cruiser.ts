// Module boundaries (ADR 0006), checked by `pnpm verify` (the `verify:boundaries` task in
// vite.config.ts). pnpm's isolation and the `exports` field are the first two mechanisms;
// these rules are the third: the directions allowed between packages, every workspace import
// declared in the importer's own `package.json`, no relative imports into another package, no
// imports past another package's `exports`, and no cycles.
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
  "placeholder-module": ["placeholder-shared"],
};

/** Test files may also import what `devDependencies` declares. */
const TEST_FILE = String.raw`\.test\.[cm]?[jt]sx?$`;

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
      comment: `${dir} imports a workspace package that its package.json does not declare${dev ? " (tests may use devDependencies)" : " in dependencies"}.`,
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
      rule("", { path: prefix, pathNot: TEST_FILE }, false),
      rule(":tests", { path: `${prefix}.*${TEST_FILE}` }, true),
    ];
  });
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
      exclude: { path: "(^|/)dist/" },
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
