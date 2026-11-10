import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite-plus";
import { expect, it } from "vite-plus/test";
import { inspectStartup, startupBundle, type StartupChunk } from "../startup-bundle.ts";

function chunk(fileName: string, options: Partial<StartupChunk> = {}): StartupChunk {
  return { fileName, isEntry: false, imports: [], code: "abc", modules: {}, ...options };
}

it("counts shared startup chunks once, using bytes, and ignores deferred Views", () => {
  expect(
    inspectStartup(
      [
        chunk("main.js", { isEntry: true, imports: ["shared.js", "other.js"] }),
        chunk("other.js", { imports: ["shared.js"] }),
        chunk("shared.js", { code: "ä" }),
        chunk("view.js", { code: "too big", modules: { "/view.tsx": {} } }),
      ],
      new Set(["/view.tsx"]),
      8,
    ),
  ).toEqual({
    bytes: 8,
    maxBytes: 8,
    chunks: ["main.js", "other.js", "shared.js"],
    eagerLazyModules: [],
    problems: [],
  });
});

it("rejects a View entering a shared startup chunk even below the size limit", () => {
  const result = inspectStartup(
    [
      chunk("main.js", { isEntry: true, imports: ["shared.js"] }),
      chunk("shared.js", { modules: { "/view.tsx": {} } }),
    ],
    new Set(["/view.tsx"]),
    100,
  );
  expect(result.problems).toEqual(["Lazy module entered the startup bundle: /view.tsx"]);
});

it("rejects oversized startup code and incomplete graphs", () => {
  expect(inspectStartup([chunk("main.js", { isEntry: true })], new Set(), 2).problems).toEqual([
    "Startup JavaScript is 3 bytes; limit is 2 bytes",
  ]);
  expect(() => inspectStartup([], new Set(), 2)).toThrow("No startup entry");
  expect(() =>
    inspectStartup([chunk("main.js", { isEntry: true, imports: ["missing.js"] })], new Set(), 100),
  ).toThrow("Missing startup chunk");
});

it("fails a real production build if a dynamically loaded View is also imported eagerly", async () => {
  const root = mkdtempSync(join(tmpdir(), "startup-bundle-"));
  const run = (limit = 10_000) =>
    build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [startupBundle(limit)],
      build: { write: false, minify: false, rolldownOptions: { input: join(root, "main.js") } },
    });
  try {
    writeFileSync(join(root, "view.js"), 'export const value = "view";');
    writeFileSync(join(root, "main.js"), 'globalThis.loadView = () => import("./view.js");');
    const built = await run();
    if (Array.isArray(built) || !("output" in built)) throw new Error("Expected one build output");
    const reportAsset = built.output.find((item) => item.fileName === "startup-bundle.json");
    if (!reportAsset || reportAsset.type !== "asset") throw new Error("Missing startup report");
    const report: { bytes: number; chunks: string[] } = JSON.parse(String(reportAsset.source));
    expect(report.bytes).toBe(
      built.output.reduce(
        (total, item) =>
          total +
          (item.type === "chunk" && report.chunks.includes(item.fileName)
            ? Buffer.byteLength(item.code)
            : 0),
        0,
      ),
    );
    await expect(run(1)).rejects.toThrow("Startup JavaScript");
    writeFileSync(
      join(root, "main.js"),
      'import { value } from "./view.js"; console.log(value); globalThis.loadView = () => import("./view.js");',
    );
    await expect(run()).rejects.toThrow("Lazy module entered the startup bundle");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
