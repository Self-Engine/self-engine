import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_THEMES,
  contrastRatio,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  type FinalColors,
  resolveAppearance,
  resolveColorMode,
  type ThemeCatalog,
  type ThemeColors,
} from "./index.ts";

const resolved = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);

describe("resolveAppearance with the default appearance", () => {
  it("returns the Neutral Theme's table for each Color Mode", () => {
    expect(resolved.light.roles.text).toBe("#18181b");
    expect(resolved.light.roles.canvas).toBe("#ffffff");
    expect(resolved.dark.roles.text).toBe("#ededf0");
    expect(resolved.dark.roles.canvas).toBe("#141416");
  });

  it.each(["light", "dark"] as const)("gives %s a value for all 22 Color Roles", (mode) => {
    const names: (keyof FinalColors)[] = [
      "chrome",
      "navSurface",
      "canvas",
      "surface",
      "surfaceRaised",
      "text",
      "textMuted",
      "border",
      "borderControl",
      "hover",
      "error",
      "onError",
      "errorSoft",
      "errorText",
      "warning",
      "onWarning",
      "warningSoft",
      "warningText",
      "success",
      "onSuccess",
      "successSoft",
      "successText",
    ];
    for (const name of names) expect(resolved[mode].roles[name], name).toMatch(/^#[0-9a-f]{6}/);
  });

  it("keeps hover as the only translucent role", () => {
    for (const { roles } of [resolved.light, resolved.dark]) {
      for (const [name, value] of Object.entries(roles)) {
        expect(value, name).toMatch(name === "hover" ? /^#[0-9a-f]{8}$/ : /^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("calculated values", () => {
  it("makes navSurface surface over chrome at 70 %, opaque", () => {
    // light: 255 * 0.7 + 247 * 0.3 = 252.6, 255 * 0.7 + 248 * 0.3 = 252.9
    expect(resolved.light.roles.navSurface).toBe("#fdfdfd");
    // dark: 26 * 0.7 + 14 * 0.3 = 22.4, 29 * 0.7 + 16 * 0.3 = 25.1
    expect(resolved.dark.roles.navSurface).toBe("#161619");
  });

  it("uses the fixed blue Accent, whatever the setting says for now", () => {
    const unknown = resolveAppearance({ ...DEFAULT_APPEARANCE, accent: "nope" }, BUILT_IN_THEMES);
    expect(resolved.light.roles.accent).toBe("#1c6ed5");
    expect(unknown.light.roles.accent).toBe("#1c6ed5");
  });
});

describe("the data handed to CSS and Mantine", () => {
  it("names every role as a --se-* variable in kebab case", () => {
    const { cssVariables } = resolved.light;
    expect(cssVariables["--se-text-muted"]).toBe("#63636b");
    expect(cssVariables["--se-nav-surface"]).toBe("#fdfdfd");
    expect(cssVariables["--se-on-accent"]).toBe("#ffffff");
    expect(cssVariables["--se-border-control"]).toBe("#8a8a93");
    expect(Object.keys(cssVariables)).toHaveLength(26);
  });

  it("makes Mantine's scheme-dependent variables follow the roles", () => {
    expect(resolved.dark.mantineVariables).toEqual({
      "--mantine-color-body": "#141416",
      "--mantine-color-text": "#ededf0",
      "--mantine-color-bright": "#ededf0",
      "--mantine-color-dimmed": "#a1a1aa",
      "--mantine-color-placeholder": "#a1a1aa",
      "--mantine-color-anchor": "#74b0ff",
      "--mantine-color-error": "#ff8f8f",
      "--mantine-color-success": "#6fd68f",
      "--mantine-color-default": "#1a1a1d",
      "--mantine-color-default-hover": "#ffffff14",
      "--mantine-color-default-color": "#ededf0",
      "--mantine-color-default-border": "#71717a",
    });
  });
});

describe("the neutral palette Mantine reads as gray (light) and dark (dark)", () => {
  it.each(["light", "dark"] as const)("gives %s ten opaque shades, lightest first", (mode) => {
    const palette = resolved[mode].neutralPalette;
    expect(palette).toHaveLength(10);
    for (const shade of palette) expect(shade).toMatch(/^#[0-9a-f]{6}$/);
    const brightness = palette.map((shade) => contrastRatio(shade, "#000000"));
    expect(brightness).toEqual(brightness.toSorted((a, b) => b - a));
  });

  // The slots follow what Mantine 9.7.5's stylesheet reads from each index.
  it("puts the light roles where the light scheme reads gray", () => {
    const gray = resolved.light.neutralPalette;
    expect(gray[1], "filled input, menu hover: hover over surface").toBe("#ededed");
    expect(gray[3], "card and divider border").toBe("#e7e7ea");
    expect(gray[4], "input outline").toBe("#8a8a93");
    expect(gray[6], "dimmed, chevrons").toBe("#63636b");
    expect(gray[9], "tooltip background").toBe("#18181b");
  });

  it("puts the dark roles where the dark scheme reads dark", () => {
    const dark = resolved.dark.neutralPalette;
    expect(dark[0], "text").toBe("#ededf0");
    expect(dark[2], "dimmed").toBe("#a1a1aa");
    expect(dark[4], "input outline").toBe("#71717a");
    expect(dark[5], "filled input: hover over surface").toBe("#2c2c2f");
    expect(dark[6], "input, card, popover background").toBe("#1a1a1d");
    expect(dark[7], "body").toBe("#141416");
    expect(dark[8], "outermost background").toBe("#0e0e10");
  });

  it("stays in order for a Theme whose surfaces do not get darker inwards", () => {
    const catalog: ThemeCatalog = {
      ...BUILT_IN_THEMES,
      inverted: {
        version: 1,
        id: "inverted",
        name: "Inverted",
        colors: {
          dark: {
            ...DEFAULT_THEME.colors.dark,
            chrome: "#3a3a40",
            canvas: "#2a2a30",
            surface: "#101014",
          },
        },
      },
    };
    const { neutralPalette } = resolveAppearance(
      { ...DEFAULT_APPEARANCE, darkTheme: "inverted" },
      catalog,
    ).dark;
    const brightness = neutralPalette.map((shade) => contrastRatio(shade, "#000000"));
    expect(neutralPalette).toContain("#101014");
    expect(brightness).toEqual(brightness.toSorted((a, b) => b - a));
  });
});

describe("Mantine's white", () => {
  const catalog: ThemeCatalog = {
    ...BUILT_IN_THEMES,
    cream: {
      version: 1,
      id: "cream",
      name: "Cream",
      colors: { light: { ...DEFAULT_THEME.colors.light, surface: "#fffaf0" } },
    },
  };
  const values = resolveAppearance({ ...DEFAULT_APPEARANCE, lightTheme: "cream" }, catalog);

  it("is the surface in light, because inputs, cards and popovers paint with it there", () => {
    expect(values.light.mantineVariables["--mantine-color-white"]).toBe("#fffaf0");
  });

  it("stays white in dark, where it only means text and icons on fills", () => {
    expect(values.dark.mantineVariables).not.toHaveProperty(["--mantine-color-white"]);
  });
});

describe("the catalog", () => {
  it("falls back to Neutral for an unknown Theme id", () => {
    const values = resolveAppearance(
      { ...DEFAULT_APPEARANCE, lightTheme: "gone", darkTheme: "gone" },
      BUILT_IN_THEMES,
    );
    expect(values).toEqual(resolved);
  });

  it("refuses a Theme table that lacks a Color Role at compile time", () => {
    // @ts-expect-error `textMuted` and the other roles are missing.
    const incomplete: ThemeColors = { text: "#000000" };
    expect(incomplete.text).toBe("#000000");
  });
});

describe("resolveColorMode", () => {
  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"],
  ] as const)("%s with system dark=%s gives %s", (setting, systemDark, expected) => {
    expect(resolveColorMode(setting, systemDark)).toBe(expected);
  });
});
