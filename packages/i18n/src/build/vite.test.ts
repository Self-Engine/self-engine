import { resolve } from "node:path";
import { build } from "vite-plus";
import type { Rolldown } from "vite-plus";
import { describe, expect, test } from "vite-plus/test";
import { linguiPlugin } from "./vite.ts";

const TEST_DIR = resolve(import.meta.dirname, "../../test");

async function bundle(entry: string): Promise<Rolldown.OutputChunk[]> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    root: TEST_DIR,
    plugins: [linguiPlugin({ configPath: resolve(TEST_DIR, "lingui.config.ts") })],
    build: { write: false, rollupOptions: { input: resolve(TEST_DIR, entry) } },
  });
  if (!("output" in result)) throw new Error("Expected one build output");
  return result.output.filter((item) => item.type === "chunk");
}

describe("the build plugin", () => {
  test("a build has one lazy catalog chunk per language", async () => {
    const chunks = await bundle("build/one-chunk-per-language.ts");
    const catalogChunks = chunks.filter((chunk) => chunk.facadeModuleId?.endsWith(".po"));
    const names = catalogChunks.map((chunk) => chunk.name).toSorted();
    expect(names).toEqual(["de", "en"]);
    expect(catalogChunks.every((chunk) => chunk.isDynamicEntry)).toBe(true);
  });

  test("a catalog that does not compile fails the build", async () => {
    await expect(bundle("build/broken-catalog.ts")).rejects.toThrow(/failOnCompileError/);
  });
});
