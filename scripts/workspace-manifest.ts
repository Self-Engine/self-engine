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

/**
 * The cycles between workspace packages, each as the sorted names of the packages it joins, in
 * order of their first name. A package depends on what its manifest declares with `workspace:`,
 * devDependencies included: pnpm links both, and a test that imports a package above its own
 * closes a cycle as well (ADR 0006). dependency-cruiser sees cycles between files only.
 */
export function packageCycles(packages: readonly WorkspacePackage[]): string[][] {
  const edges = new Map(
    packages.map(({ manifest }) => [manifest.name, workspaceDependencies(manifest, { dev: true })]),
  );
  // Tarjan's strongly connected components.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  const visit = (name: string): void => {
    index.set(name, index.size);
    low.set(name, index.get(name)!);
    stack.push(name);
    onStack.add(name);
    for (const next of edges.get(name) ?? []) {
      if (!edges.has(next)) continue;
      if (!index.has(next)) {
        visit(next);
        low.set(name, Math.min(low.get(name)!, low.get(next)!));
      } else if (onStack.has(next)) low.set(name, Math.min(low.get(name)!, index.get(next)!));
    }
    if (low.get(name) !== index.get(name)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== name);
    if (component.length > 1 || edges.get(name)!.includes(name)) cycles.push(component.sort());
  };
  for (const name of edges.keys()) if (!index.has(name)) visit(name);
  return cycles.sort((a, b) => a[0]!.localeCompare(b[0]!));
}
