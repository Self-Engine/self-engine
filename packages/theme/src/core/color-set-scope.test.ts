import { describe, expect, it } from "vite-plus/test";
import { BUILT_IN_THEMES, colorSetColor, DEFAULT_APPEARANCE, resolveAppearance } from "./index.ts";

const resolved = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);

describe("the Color Set scopes, for Module Colors and the colors of entries", () => {
  it("are all twelve Color Sets, those that are no Accent included", () => {
    expect(Object.keys(resolved.light.colorSetScopes)).toEqual([
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
    expect(resolved.light.colorSetScopes["yellow"]).toEqual({
      "--se-color-set": "#f6bd0c",
      "--se-color-set-on": "#2a1f00",
      "--se-color-set-soft": "#fbf1cf",
      "--se-color-set-text": "#7a5700",
    });
  });

  it("give each Color Set's values for the Color Mode to the four variables", () => {
    expect(resolved.light.colorSetScopes["teal"]).toEqual({
      "--se-color-set": "#0b7a6e",
      "--se-color-set-on": "#ffffff",
      "--se-color-set-soft": "#e0f5f1",
      "--se-color-set-text": "#0a6c61",
    });
    expect(resolved.dark.colorSetScopes["teal"]).toEqual({
      "--se-color-set": "#0b7a6e",
      "--se-color-set-on": "#ffffff",
      "--se-color-set-soft": "#0f332e",
      "--se-color-set-text": "#4fd1bd",
    });
  });
});

describe("the Color Set scope rules", () => {
  it("scope the four variables to data-color-set, for the Color Mode", () => {
    expect(resolved.light.colorSetScopeCss).toContain(
      '[data-color-set="teal"]{--se-color-set:#0b7a6e;--se-color-set-on:#ffffff;--se-color-set-soft:#e0f5f1;--se-color-set-text:#0a6c61;}',
    );
    expect(resolved.dark.colorSetScopeCss).toContain(
      '[data-color-set="teal"]{--se-color-set:#0b7a6e;--se-color-set-on:#ffffff;--se-color-set-soft:#0f332e;--se-color-set-text:#4fd1bd;}',
    );
  });

  it("hold one rule per Color Set, so that scopes can sit side by side", () => {
    const names = [...resolved.dark.colorSetScopeCss.matchAll(/data-color-set="(\w+)"/g)].map(
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
    expect(other.light.colorSetScopeCss).toBe(resolved.light.colorSetScopeCss);
  });
});

describe("colorSetColor", () => {
  it("follows a role of the Color Set of the nearest scope through its variable", () => {
    expect(colorSetColor("accent")).toBe("var(--se-color-set)");
    expect(colorSetColor("onAccent")).toBe("var(--se-color-set-on)");
    expect(colorSetColor("accentSoft")).toBe("var(--se-color-set-soft)");
    expect(colorSetColor("accentText")).toBe("var(--se-color-set-text)");
  });

  it("names only variables the scope rules set", () => {
    for (const role of ["accent", "onAccent", "accentSoft", "accentText"] as const) {
      const variable = colorSetColor(role).slice("var(".length, -1);
      expect(resolved.light.colorSetScopeCss).toContain(`${variable}:`);
    }
  });
});
