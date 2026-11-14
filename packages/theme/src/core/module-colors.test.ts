import { describe, expect, it } from "vite-plus/test";
import { BUILT_IN_THEMES, DEFAULT_APPEARANCE, resolveAppearance } from "./index.ts";

const resolved = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);

describe("the Module Colors", () => {
  it("are all twelve Color Sets, those that are no Accent included", () => {
    expect(Object.keys(resolved.light.moduleColors)).toEqual([
      "red",
      "pink",
      "grape",
      "violet",
      "indigo",
      "blue",
      "cyan",
      "teal",
      "green",
      "lime",
      "yellow",
      "orange",
    ]);
  });

  it("give yellow its dark text on the fill, which is lighter than the text", () => {
    expect(resolved.light.moduleColors["yellow"]).toEqual({
      "--se-module": "#f6bd0c",
      "--se-module-on": "#2a1f00",
      "--se-module-soft": "#fbf1cf",
      "--se-module-text": "#7a5700",
    });
  });

  it("give each Color Set's values for the Color Mode to the four variables", () => {
    expect(resolved.light.moduleColors["teal"]).toEqual({
      "--se-module": "#0b7a6e",
      "--se-module-on": "#ffffff",
      "--se-module-soft": "#e0f5f1",
      "--se-module-text": "#0a6c61",
    });
    expect(resolved.dark.moduleColors["teal"]).toEqual({
      "--se-module": "#0b7a6e",
      "--se-module-on": "#ffffff",
      "--se-module-soft": "#0f332e",
      "--se-module-text": "#4fd1bd",
    });
  });
});

describe("the Module Color rules", () => {
  it("scope the four variables to data-module-color, for the Color Mode", () => {
    expect(resolved.light.moduleColorCss).toContain(
      '[data-module-color="teal"]{--se-module:#0b7a6e;--se-module-on:#ffffff;--se-module-soft:#e0f5f1;--se-module-text:#0a6c61;}',
    );
    expect(resolved.dark.moduleColorCss).toContain(
      '[data-module-color="teal"]{--se-module:#0b7a6e;--se-module-on:#ffffff;--se-module-soft:#0f332e;--se-module-text:#4fd1bd;}',
    );
  });

  it("hold one rule per Color Set, so that scopes can sit side by side", () => {
    const names = [...resolved.dark.moduleColorCss.matchAll(/data-module-color="(\w+)"/g)].map(
      ([, name]) => name,
    );
    expect(names).toEqual([
      "red",
      "pink",
      "grape",
      "violet",
      "indigo",
      "blue",
      "cyan",
      "teal",
      "green",
      "lime",
      "yellow",
      "orange",
    ]);
  });

  it("do not change with the Theme or the Accent", () => {
    const other = resolveAppearance(
      { ...DEFAULT_APPEARANCE, lightTheme: "warm", accent: "pink", backgroundTint: false },
      BUILT_IN_THEMES,
    );
    expect(other.light.moduleColorCss).toBe(resolved.light.moduleColorCss);
  });
});
