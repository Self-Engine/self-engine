import { describe, expect, it } from "vite-plus/test";
import { packEntries } from "../vite.config.ts";
import { bundleDirectory } from "./channel.ts";

describe("packEntries", () => {
  it("builds main, preload and the data process", () => {
    expect(packEntries("dev").map((entry) => entry.entry[0])).toEqual([
      "src/main.ts",
      "src/preload.ts",
      "src/data-process.ts",
    ]);
  });

  it("leaves the native SQLite module out of the data process", () => {
    const dataProcess = packEntries("dev").find(
      (entry) => entry.entry[0] === "src/data-process.ts",
    );
    expect(dataProcess?.deps.neverBundle("better-sqlite3")).toBe(true);
    expect(dataProcess?.deps.neverBundle("better-sqlite3-helper")).toBe(false);
  });

  it.each(packEntries("dev").map((entry) => [entry.entry[0], entry] as const))(
    "%s is CommonJS and never bundles electron",
    (_name, entry) => {
      expect(entry.format).toBe("cjs");
      expect(entry.deps.neverBundle("electron")).toBe(true);
      expect(entry.deps.neverBundle("electron/renderer")).toBe(true);
      expect(entry.deps.neverBundle("electron-store")).toBe(false);
    },
  );

  it.each(["dev", "nightly", "stable"] as const)(
    "builds the %s channel into every bundle",
    (channel) => {
      for (const entry of packEntries(channel)) {
        expect(entry.define).toEqual({ __SELF_ENGINE_CHANNEL__: JSON.stringify(channel) });
      }
    },
  );

  it.each(["dev", "nightly", "stable"] as const)("writes %s to its own folder", (channel) => {
    for (const entry of packEntries(channel)) {
      expect(entry.outDir).toBe(bundleDirectory(channel));
    }
  });
});
