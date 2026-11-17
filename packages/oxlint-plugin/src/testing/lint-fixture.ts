// Runs the real Oxlint on source snippets with one rule of this plugin enabled, in a temp
// directory, and returns the diagnostics of that rule. Oxlint is a dependency of vite-plus, so
// its package is resolved through vite-plus instead of a hardcoded node_modules layout.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const oxlintBin = join(
  dirname(createRequire(require.resolve("vite-plus/package.json")).resolve("oxlint/package.json")),
  "bin",
  "oxlint",
);
const pluginPath = resolve(import.meta.dirname, "../index.ts");

/**
 * The diagnostic lines of one file, by its base name. Oxlint prints the bare file name on
 * Linux and the absolute path on macOS, where the temp directory sits behind a symlink.
 */
export function diagnosticsOfFile(lines: readonly string[], fileName: string): string[] {
  return lines.filter((line) => basename(line.split(":", 1)[0] ?? "") === fileName);
}

/** A fixture whose file name matters to the rule: `path` is relative to the fixture folder. */
export interface NamedFixture {
  readonly path: string;
  readonly source: string;
}

/**
 * The `self-engine/<rule>` diagnostics Oxlint reports for each of `sources`, one line each, in
 * the order of `sources`. One Oxlint run covers them all, so a long fixture table stays fast.
 * A plain source is written as `fixture-<index>.ts`; diagnostics are matched by file name, so
 * two fixtures of one run must not share one.
 */
export function lintFixtures(
  rule: string,
  sources: readonly (string | NamedFixture)[],
  folder = "",
): string[][] {
  const paths = sources.map((source, index) =>
    typeof source === "string" ? `fixture-${index}.ts` : source.path,
  );
  const names = paths.map((path) => basename(path));
  const shared = names.find((name, index) => names.indexOf(name) !== index);
  if (shared !== undefined) throw new Error(`Two fixtures share the file name ${shared}`);
  const dir = mkdtempSync(join(tmpdir(), "self-engine-oxlint-"));
  try {
    const config = join(dir, ".oxlintrc.json");
    const files = sources.map((source, index) => {
      const file = join(dir, folder, paths[index] ?? "");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, typeof source === "string" ? source : source.source);
      return file;
    });
    writeFileSync(
      config,
      JSON.stringify({
        plugins: [],
        jsPlugins: [pluginPath],
        rules: { [`self-engine/${rule}`]: "error" },
      }),
    );
    // Through the current Node binary, so the plugin's TypeScript loads with this Node's
    // type stripping rather than whatever `node` comes first on PATH.
    const result = spawnSync(
      process.execPath,
      [oxlintBin, "--config", config, "--format", "unix", ...files],
      { cwd: dir, encoding: "utf8" },
    );
    if (result.error) throw result.error;
    const hits = result.stdout.split("\n").filter((line) => line.includes(`self-engine(${rule})`));
    // Oxlint exits 1 when it reports an error. Any other code, or an exit 1 without a hit of
    // the rule (a plugin that failed to load), is a failed run, not a clean fixture.
    if (result.status !== 0 && !(result.status === 1 && hits.length > 0)) {
      throw new Error(`oxlint exited with ${result.status}:\n${result.stdout}${result.stderr}`);
    }
    return names.map((name) => diagnosticsOfFile(hits, name));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The `self-engine/<rule>` diagnostics Oxlint reports for `source`, one line each. */
export function lintFixture(rule: string, source: string): string[] {
  return lintFixtures(rule, [source])[0] ?? [];
}
