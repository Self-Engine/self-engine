import { describe, expect, it } from "vite-plus/test";
import { BUILT_IN_THEMES, DEFAULT_APPEARANCE, resolveAppearance } from "./index.ts";

const resolved = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);

describe("the Module Colors", () => {
  it("are all eight Color Sets, green included although it is no Accent", () => {
    expect(Object.keys(resolved.light.moduleColors)).toEqual([
      "blue",
      "indigo",
      "violet",
      "teal",
      "orange",
      "grape",
      "green",
      "pink",
    ]);
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
    expect(names).toEqual(["blue", "indigo", "violet", "teal", "orange", "grape", "green", "pink"]);
  });

  it("do not change with the Theme or the Accent", () => {
    const other = resolveAppearance(
      { ...DEFAULT_APPEARANCE, lightTheme: "warm", accent: "pink", backgroundTint: false },
      BUILT_IN_THEMES,
    );
    expect(other.light.moduleColorCss).toBe(resolved.light.moduleColorCss);
  });
});
