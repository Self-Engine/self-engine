import { DEFAULT_APPEARANCE } from "@self-engine/theme";
import { describe, expect, it } from "vite-plus/test";
import { appearanceOf, initialGlobals, languageOf } from "./toolbar.ts";

describe("the toolbar's starting values", () => {
  it("are the appearance story tests run in: the default, in light and English (ADR 0012)", () => {
    expect(appearanceOf(initialGlobals)).toEqual({ ...DEFAULT_APPEARANCE, colorMode: "light" });
    expect(languageOf(initialGlobals)).toBe("en");
  });
});
