// Reads the `package.json` of workspace packages (`apps/*`, `packages/*`), for the boundary
// rules in .dependency-cruiser.ts and their tests. One parser, so the rules and the tests
// agree on what a package declares.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The folders that hold workspace packages, as in pnpm-workspace.yaml. */
export const WORKSPACE_FOLDERS = ["apps", "packages"] as const;

export interface Manifest {
  readonly name: string;
  readonly exports: unknown;
  /** Package names in `dependencies`, with their version specifier. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** Package names in `devDependencies`, with their version specifier. */
  readonly devDependencies: Readonly<Record<string, string>>;
}

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** The manifest in `dir`, with absent dependency fields as empty records. */
export function readManifest(dir: string): Manifest {
  const raw: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const field = (key: string): unknown =>
    typeof raw === "object" && raw !== null ? Reflect.get(raw, key) : undefined;
  const name = field("name");
  return {
    name: typeof name === "string" ? name : "",
    exports: field("exports"),
    dependencies: stringRecord(field("dependencies")),
    devDependencies: stringRecord(field("devDependencies")),
  };
}

/**
 * The names a manifest declares with the `workspace:` protocol: from `dependencies`, and also
 * from `devDependencies` when `dev` is set.
 */
export function workspaceDependencies(manifest: Manifest, { dev }: { dev: boolean }): string[] {
  const declared = dev
    ? { ...manifest.devDependencies, ...manifest.dependencies }
    : manifest.dependencies;
  return Object.entries(declared)
    .filter(([, version]) => version.startsWith("workspace:"))
    .map(([name]) => name)
    .sort();
}

export interface WorkspacePackage {
  /** Folder relative to the workspace root, e.g. `packages/time`. */
  readonly dir: string;
  readonly manifest: Manifest;
}

/** Every folder under `apps/` and `packages/` of `root` that has a `package.json`, sorted. */
export function workspacePackages(root: string): WorkspacePackage[] {
  return WORKSPACE_FOLDERS.flatMap((folder) => {
    const parent = join(root, folder);
    if (!existsSync(parent)) return [];
    return readdirSync(parent, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && existsSync(join(parent, entry.name, "package.json")),
      )
      .map((entry) => `${folder}/${entry.name}`);
  })
    .sort()
    .map((dir) => ({ dir, manifest: readManifest(join(root, dir)) }));
}
