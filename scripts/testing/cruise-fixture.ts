// Runs dependency-cruiser with the repo's boundary rules (`boundaryConfig` in
// .dependency-cruiser.ts) on a small workspace written to a temp directory, and returns the
// rule violations. A fixture package gets a real package.json and, like pnpm, a node_modules
// link to each workspace package it declares, so resolution through `exports` behaves as in
// the repo.

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { cruise, type ICruiseResult } from "dependency-cruiser";
import { type AllowedImports, boundaryConfig } from "../../.dependency-cruiser.ts";

const SCOPE = "@self-engine";

export interface FixturePackage {
  /** Folder relative to the workspace root, e.g. `packages/shared`. */
  readonly dir: string;
  /** Package names in `dependencies`, e.g. `@self-engine/shared` or `left-pad`. */
  readonly dependencies?: readonly string[];
  /** Package names in `devDependencies`. */
  readonly devDependencies?: readonly string[];
  /** The `exports` field; by default only `.` → `./src/index.ts`. */
  readonly exports?: Readonly<Record<string, string | Readonly<Record<string, string>>>>;
  /** Source files by path relative to `dir`. */
  readonly files: Readonly<Record<string, string>>;
}

export interface FixtureOptions {
  /** The allowed directions between the fixture's packages; none by default. */
  readonly allowedImports?: AllowedImports;
  /** Empty npm packages at the workspace root that no fixture package declares. */
  readonly npmPackages?: readonly string[];
  /**
   * Workspace packages linked into the root `node_modules`, as pnpm does for the root
   * `package.json`'s own dependencies. Node resolution finds them from every package.
   */
  readonly rootDependencies?: readonly string[];
}

export interface Violation {
  readonly rule: string;
  readonly from: string;
  readonly to: string;
}

/** `@self-engine/<folder name>`, the name every workspace package carries. */
export function packageName(dir: string): string {
  return `${SCOPE}/${basename(dir)}`;
}

/** Adds or replaces source files of a fixture package. */
export function withFiles(
  fixture: FixturePackage,
  files: Readonly<Record<string, string>>,
): FixturePackage {
  return { ...fixture, files: { ...fixture.files, ...files } };
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function link(from: string, to: string): void {
  mkdirSync(dirname(from), { recursive: true });
  symlinkSync(relative(dirname(from), to), from, "dir");
}

/**
 * The violations of the repo's rules in a workspace made of `packages`. A declared dependency
 * that is not one of `packages`, and each of `npmPackages`, becomes an empty npm package at
 * the workspace root.
 */
export async function cruiseFixture(
  packages: readonly FixturePackage[],
  { allowedImports = {}, npmPackages = [], rootDependencies = [] }: FixtureOptions = {},
): Promise<Violation[]> {
  // The real path: macOS's tmpdir is behind a symlink, and dependency-cruiser follows
  // symlinks, so the linked workspace packages would land outside the fixture root.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "self-engine-depcruise-")));
  try {
    const workspace = new Map(packages.map((fixture) => [packageName(fixture.dir), fixture.dir]));
    const writeNpmPackage = (name: string) => {
      write(join(root, "node_modules", name, "package.json"), JSON.stringify({ name }));
      write(join(root, "node_modules", name, "index.js"), "export {};\n");
    };
    npmPackages.forEach(writeNpmPackage);
    for (const name of rootDependencies) {
      const target = workspace.get(name);
      if (target === undefined) throw new Error(`${name} is not a fixture package`);
      link(join(root, "node_modules", name), join(root, target));
    }
    for (const fixture of packages) {
      const dependencies = fixture.dependencies ?? [];
      const devDependencies = fixture.devDependencies ?? [];
      const versions = (names: readonly string[]) =>
        Object.fromEntries(
          names.map((name) => [name, workspace.has(name) ? "workspace:*" : "1.0.0"]),
        );
      write(
        join(root, fixture.dir, "package.json"),
        JSON.stringify({
          name: packageName(fixture.dir),
          type: "module",
          exports: fixture.exports ?? { ".": "./src/index.ts" },
          dependencies: versions(dependencies),
          devDependencies: versions(devDependencies),
        }),
      );
      for (const [path, content] of Object.entries(fixture.files)) {
        write(join(root, fixture.dir, path), content);
      }
      for (const name of [...dependencies, ...devDependencies]) {
        const target = workspace.get(name);
        if (target === undefined) writeNpmPackage(name);
        else link(join(root, fixture.dir, "node_modules", name), join(root, target));
      }
    }
    const config = boundaryConfig({ allowedImports, rootDir: root });
    const roots = [...new Set(packages.map((fixture) => fixture.dir.split("/")[0] ?? ""))];
    const { output } = await cruise(roots, {
      ...config.options,
      ruleSet: config,
      validate: true,
      baseDir: root,
      outputType: "json",
    });
    // The json reporter returns the result serialized.
    const result = (typeof output === "string" ? JSON.parse(output) : output) as ICruiseResult;
    return violations(result);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function violations(result: ICruiseResult): Violation[] {
  return result.summary.violations.map(({ rule, from, to }) => ({ rule: rule.name, from, to }));
}

/** The names of the violated rules, sorted, each once. */
export function ruleNames(found: readonly Violation[]): string[] {
  return [...new Set(found.map((violation) => violation.rule))].sort();
}
