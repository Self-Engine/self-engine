import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  serializeStartCache,
  START_CACHE_KEY,
  writeStartCache,
} from "./index.ts";

const resolved = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);

describe("writeStartCache", () => {
  it("stores the serialized output under the Start Cache key", () => {
    const written = new Map<string, string>();

    writeStartCache(() => ({ setItem: (key, value) => written.set(key, value) }), "dark", resolved);

    expect(written.get(START_CACHE_KEY)).toBe(serializeStartCache("dark", resolved));
  });

  it("survives a storage that rejects the write, because the cache is only a copy", () => {
    const full = () => ({
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    expect(() => writeStartCache(full, "system", resolved)).not.toThrow();
  });

  it("survives a storage that cannot even be reached", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };

    expect(() => writeStartCache(blocked, "system", resolved)).not.toThrow();
  });
});
