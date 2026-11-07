// Module boundaries (ADR 0006), checked by `pnpm verify` (the `verify:boundaries` task in
// vite.config.ts). pnpm's isolation and the `exports` field are the first two mechanisms;
// these rules are the third: the directions allowed between packages, no relative imports
// across a package boundary, no imports past another package's `exports`, and no cycles.
//
// Paths are relative to the repo root, or to the fixture root in
// scripts/dependency-cruiser.test.ts.

import type { IConfiguration, IForbiddenRuleType } from "dependency-cruiser";

/**
 * The workspace packages (folder names under `packages/`) each package may import besides
 * itself. A package that is missing here may import no other workspace package. Adding an
 * edge is a change here and in that package's `package.json`, so a review sees both.
 */
export const ALLOWED_IMPORTS: Readonly<Record<string, readonly string[]>> = {
  "placeholder-module": ["placeholder-shared"],
};

function alternatives(names: readonly string[]): string {
  return names.map((name) => name.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

/** One rule per package in ALLOWED_IMPORTS: no workspace package outside its list. */
function allowedDirectionRules(): IForbiddenRuleType[] {
  return Object.entries(ALLOWED_IMPORTS).map(([name, allowed]) => ({
    name: `package-direction:${name}`,
    comment: `packages/${name} may import only ${["itself", ...allowed].join(", ")} (ALLOWED_IMPORTS in .dependency-cruiser.ts).`,
    severity: "error",
    from: { path: `^packages/(?:${alternatives([name])})/` },
    to: { path: "^packages/", pathNot: `^packages/(?:${alternatives([name, ...allowed])})/` },
  }));
}

const forbidden: IForbiddenRuleType[] = [
  ...allowedDirectionRules(),
  {
    name: "package-direction:unlisted",
    comment:
      "A package without an entry in ALLOWED_IMPORTS (.dependency-cruiser.ts) may import no other workspace package.",
    severity: "error",
    from: { path: `^packages/(?!(?:${alternatives(Object.keys(ALLOWED_IMPORTS))})/)([^/]+)/` },
    to: { path: "^packages/", pathNot: "^packages/$1/" },
  },
  {
    name: "no-relative-import-across-packages",
    comment:
      "A relative import that leaves its package skips the other package's `exports`. Import it by its package name.",
    severity: "error",
    from: { path: "^packages/([^/]+)/" },
    to: { dependencyTypes: ["local"], pathNot: "^packages/$1/" },
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
    name: "no-circular",
    comment: "Modules in a cycle cannot be understood, tested or split apart on their own.",
    severity: "error",
    from: {},
    to: { circular: true },
  },
];

const config: IConfiguration = {
  forbidden,
  options: {
    // TypeScript 7 has no JS compiler API, which dependency-cruiser's tsc parser needs. The
    // swc parser always reports type-only imports, so they are checked like any other
    // (`tsPreCompilationDeps` is a tsc option and would only warn that tsc is missing).
    parser: "swc",
    // Imports of npm packages stay in the graph (so `not-to-undeclared` sees them), but
    // their own imports are not followed. `exclude` would drop them from the graph.
    doNotFollow: { path: "(^|/)node_modules/" },
    exclude: { path: "(^|/)dist/" },
    enhancedResolveOptions: {
      // Resolve workspace packages through their `exports` only, so a deep import fails.
      exportsFields: ["exports"],
      conditionNames: ["import", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
      mainFields: ["module", "main"],
    },
  },
};

export default config;
