import {
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  resolveColorMode,
} from "@self-engine/theme";
import { describe, expect, it } from "vite-plus/test";
import { appearanceFromStored } from "./stored-preview-appearance.ts";

describe("appearanceFromStored", () => {
  it("keeps every valid field", () => {
    const stored = {
      lightTheme: "cool",
      darkTheme: "warm",
      accent: "green",
      backgroundTint: false,
      colorMode: "dark",
      density: "compact",
      fontScale: 112.5,
    };
    expect(appearanceFromStored(stored)).toEqual(stored);
  });

  it("fills a missing field from the defaults", () => {
    expect(appearanceFromStored({ density: "compact" })).toEqual({
      ...DEFAULT_APPEARANCE,
      density: "compact",
    });
  });

  it.each([
    ["colorMode", "x"],
    ["colorMode", "constructor"],
    ["density", "tiny"],
    ["fontScale", 200],
    ["fontScale", "100"],
    ["backgroundTint", "yes"],
    ["lightTheme", 5],
    ["darkTheme", null],
    ["accent", {}],
  ])("uses the default for an invalid %s (%j)", (field, value) => {
    expect(appearanceFromStored({ [field]: value })).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps the valid fields beside an invalid one", () => {
    expect(appearanceFromStored({ colorMode: "x", density: "compact" })).toEqual({
      ...DEFAULT_APPEARANCE,
      density: "compact",
    });
  });

  it.each([
    ["null", null],
    ["an array", ["dark"]],
    ["a string", "dark"],
    ["a number", 1],
  ])("starts from the defaults for %s", (_name, stored) => {
    expect(appearanceFromStored(stored)).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps Theme and Accent ids it does not know, for the resolver's fallback", () => {
    const stored = { lightTheme: "from-a-newer-app", accent: "from-a-newer-app" };
    expect(appearanceFromStored(stored)).toEqual({ ...DEFAULT_APPEARANCE, ...stored });
  });

  it("turns an unknown Color Mode into one that has resolved values to render", () => {
    const appearance = appearanceFromStored({ colorMode: "x" });
    const resolved = resolveAppearance(appearance, BUILT_IN_THEMES);
    expect(resolved[resolveColorMode(appearance.colorMode, false)]).toBeDefined();
  });
});
