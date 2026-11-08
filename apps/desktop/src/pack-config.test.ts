import { describe, expect, it } from "vite-plus/test";
import { packEntries } from "../vite.config.ts";

describe("packEntries", () => {
  it.each(packEntries.map((entry) => [entry.entry[0], entry] as const))(
    "%s is CommonJS and never bundles electron",
    (_name, entry) => {
      expect(entry.format).toBe("cjs");
      expect(entry.deps.neverBundle("electron")).toBe(true);
      expect(entry.deps.neverBundle("electron/renderer")).toBe(true);
      expect(entry.deps.neverBundle("electron-store")).toBe(false);
    },
  );
});
