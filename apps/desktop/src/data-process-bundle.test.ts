import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "vite-plus/pack";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { packEntries } from "../vite.config.ts";

const FIXTURE = resolve(import.meta.dirname, "../test/sql-migrations");

function dataProcessBundle() {
  const entry = packEntries("dev").find((bundle) => bundle.entry[0] === "src/data-process.ts");
  if (entry === undefined) throw new Error("No data process bundle");
  return entry;
}

describe("the data process bundle", () => {
  let directory: string | undefined;
  afterEach(() => {
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  });

  test("carries a module's SQL migrations as text and reads none from disk", async () => {
    directory = mkdtempSync(join(tmpdir(), "data-process-bundle-"));
    const source = join(directory, "source");
    const outDir = join(directory, "out");
    cpSync(FIXTURE, source, { recursive: true });

    await build({
      ...dataProcessBundle(),
      config: false,
      logLevel: "silent",
      cwd: source,
      entry: [join(source, "index.ts")],
      outDir,
      sourcemap: false,
    });
    // Nothing next to the bundle or at the source is left to read at run time.
    rmSync(source, { recursive: true });

    const { migrations } = createRequire(import.meta.url)(join(outDir, "index.cjs")) as {
      migrations: Record<string, string>;
    };
    expect(migrations).toEqual({
      "./migrations/0001.sql":
        "CREATE TABLE fixture_notes (id TEXT PRIMARY KEY, body TEXT NOT NULL) STRICT;\n",
    });
  });
});

test.each([
  ["dev", true],
  ["nightly", false],
  ["stable", false],
] as const)(
  "%s bundles start the data process with output checks %s",
  async (channel, checkOutputs) => {
    const directory = mkdtempSync(join(tmpdir(), "data-process-output-checks-"));
    try {
      const entry = packEntries(channel).find(
        (bundle) => bundle.entry[0] === "src/data-process.ts",
      );
      if (entry === undefined) throw new Error("No data process bundle");
      await build({
        ...entry,
        config: false,
        logLevel: "silent",
        entry: [resolve(import.meta.dirname, "../test/output-checks/index.ts")],
        outDir: directory,
        sourcemap: false,
      });
      const { dataProcessOptions } = createRequire(import.meta.url)(
        join(directory, "index.cjs"),
      ) as { dataProcessOptions: { checkOutputs: boolean } };
      expect(dataProcessOptions.checkOutputs).toBe(checkOutputs);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
