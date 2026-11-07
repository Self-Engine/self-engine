// Runs dependency-cruiser with the repo's boundary rules (.dependency-cruiser.ts) on a small
// workspace written to a temp directory, and returns the rule violations. A fixture package
// gets a real package.json and, like pnpm, a node_modules link to each workspace package it
// declares, so resolution through `exports` behaves as in the repo.

import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { cruise, type ICruiseResult } from "dependency-cruiser";
import config from "../../.dependency-cruiser.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const SCOPE = "@self-engine";

export interface FixturePackage {
  /** Folder relative to the workspace root, e.g. `packages/placeholder-shared`. */
  readonly dir: string;
  /** Package names it declares, e.g. `@self-engine/placeholder-shared` or `left-pad`. */
  readonly dependencies?: readonly string[];
  /** The `exports` field; by default only `.` → `./src/index.ts`. */
  readonly exports?: Readonly<Record<string, string>>;
  /** Source files by path relative to `dir`. */
  readonly files: Readonly<Record<string, string>>;
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

/**
 * A repo package as a fixture: its `exports`, its declared dependencies and its source
 * files without the tests, so a fixture can add one forbidden import to the real thing.
 */
export function repoPackage(dir: string): FixturePackage {
  const manifest = JSON.parse(readFileSync(join(repoRoot, dir, "package.json"), "utf8")) as {
    exports?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  const files: Record<string, string> = {};
  const src = join(repoRoot, dir, "src");
  for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith(".test.ts")) continue;
    const path = join(entry.parentPath, entry.name);
    files[relative(join(repoRoot, dir), path)] = readFileSync(path, "utf8");
  }
  return {
    dir,
    dependencies: Object.keys(manifest.dependencies ?? {}),
    ...(manifest.exports ? { exports: manifest.exports } : {}),
    files,
  };
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

/**
 * The violations of the repo's rules in a workspace made of `packages`. A declared dependency
 * that is not one of `packages`, and each of `npmPackages`, becomes an empty npm package at
 * the workspace root.
 */
export async function cruiseFixture(
  packages: readonly FixturePackage[],
  npmPackages: readonly string[] = [],
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
    for (const fixture of packages) {
      const dependencies = fixture.dependencies ?? [];
      write(
        join(root, fixture.dir, "package.json"),
        JSON.stringify({
          name: packageName(fixture.dir),
          type: "module",
          exports: fixture.exports ?? { ".": "./src/index.ts" },
          dependencies: Object.fromEntries(
            dependencies.map((name) => [name, workspace.has(name) ? "workspace:*" : "1.0.0"]),
          ),
        }),
      );
      for (const [path, content] of Object.entries(fixture.files)) {
        write(join(root, fixture.dir, path), content);
      }
      for (const name of dependencies) {
        const target = workspace.get(name);
        if (target === undefined) {
          writeNpmPackage(name);
          continue;
        }
        const link = join(root, fixture.dir, "node_modules", name);
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(relative(dirname(link), join(root, target)), link, "dir");
      }
    }
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
