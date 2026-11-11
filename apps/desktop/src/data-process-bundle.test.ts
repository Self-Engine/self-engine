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
