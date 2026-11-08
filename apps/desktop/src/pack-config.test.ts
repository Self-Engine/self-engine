import { describe, expect, it } from "vite-plus/test";
import { packEntries } from "../vite.config.ts";
import { bundleDirectory } from "./channel.ts";

describe("packEntries", () => {
  it.each(packEntries("dev").map((entry) => [entry.entry[0], entry] as const))(
    "%s is CommonJS and never bundles electron",
    (_name, entry) => {
      expect(entry.format).toBe("cjs");
      expect(entry.deps.neverBundle("electron")).toBe(true);
      expect(entry.deps.neverBundle("electron/renderer")).toBe(true);
      expect(entry.deps.neverBundle("electron-store")).toBe(false);
    },
  );

  it.each(["dev", "nightly", "stable"] as const)("builds the %s channel into both", (channel) => {
    for (const entry of packEntries(channel)) {
      expect(entry.define).toEqual({ __SELF_ENGINE_CHANNEL__: JSON.stringify(channel) });
    }
  });

  it.each(["dev", "nightly", "stable"] as const)("writes %s to its own folder", (channel) => {
    for (const entry of packEntries(channel)) {
      expect(entry.outDir).toBe(bundleDirectory(channel));
    }
  });
});
