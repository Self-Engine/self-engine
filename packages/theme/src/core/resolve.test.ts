import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  ACCENT_IDS,
  BUILT_IN_THEMES,
  COLOR_SETS,
  type ColorSet,
  type ColorSetId,
  contrastRatio,
  COLOR_MODE_CHOICES,
  DEFAULT_APPEARANCE,
  FIXED_APPEARANCE,
  DEFAULT_THEME,
  type FinalColors,
  FROM_THEME,
  type ColorModeValues,
  resolveAppearance,
  resolveColorMode,
  type Theme,
  type ThemeCatalog,
  type ThemeColors,
} from "./index.ts";

const resolved = resolveAppearance(DEFAULT_APPEARANCE, BUILT_IN_THEMES);
const neutralDark = (BUILT_IN_THEMES["neutral"] as Theme).colors.dark as ThemeColors;

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

describe("the Background Tint", () => {
  // Expected mixes come from Oklab worked out with the published conversion matrices.
  it("mixes 15 % of the resolved Accent fill into chrome in Oklab", () => {
    expect(resolved.light.roles.chrome).toBe("#d7e3f5");
    expect(resolved.dark.roles.chrome).toBe("#131b29");
  });

  const untinted = resolveAppearance(
    { ...DEFAULT_APPEARANCE, backgroundTint: false },
    BUILT_IN_THEMES,
  );

  it("is on by default", () => {
    expect(DEFAULT_APPEARANCE.backgroundTint).toBe(true);
  });

  it("leaves the Theme's chrome alone when off", () => {
    expect(untinted.light.roles.chrome).toBe("#f7f7f8");
    expect(untinted.dark.roles.chrome).toBe("#0e0e10");
  });

  it("follows an explicit Accent", () => {
    const teal = resolveAppearance({ ...DEFAULT_APPEARANCE, accent: "teal" }, BUILT_IN_THEMES);
    expect(teal.light.roles.chrome).toBe("#d7e4e2");
  });

  it("follows the Theme's own Accent for From Theme", () => {
    const neutral = BUILT_IN_THEMES["neutral"] as Theme;
    const fill = { accent: "#7a1f1f", onAccent: "#ffffff" } as const;
    const accent: ColorSet = {
      light: { ...fill, accentSoft: "#fbeaea", accentText: "#7a1f1f" },
      dark: { ...fill, accentSoft: "#3a1515", accentText: "#f0a0a0" },
    };
    const values = resolveAppearance(
      { ...DEFAULT_APPEARANCE, lightTheme: "branded", darkTheme: "branded" },
      { branded: { ...neutral, id: "branded", accent } },
    );
    expect(values.light.roles.chrome).toBe("#e6d6d5");
    expect(values.dark.roles.chrome).toBe("#1d1213");
  });

  it("calculates navSurface from surface over the tinted chrome", () => {
    // light: 255 * 0.7 + 215 * 0.3 = 243, 255 * 0.7 + 227 * 0.3 = 246.6, 255 * 0.7 + 245 * 0.3 = 252
    expect(resolved.light.roles.navSurface).toBe("#f3f7fc");
    // dark: 26 * 0.7 + 19 * 0.3 = 23.9, 26 * 0.7 + 27 * 0.3 = 26.3, 29 * 0.7 + 41 * 0.3 = 32.6
    expect(resolved.dark.roles.navSurface).toBe("#181a21");
  });

  it.each(["light", "dark"] as const)("changes nothing but chrome and navSurface in %s", (mode) => {
    const rest = (values: ColorModeValues) => ({
      ...values,
      roles: { ...values.roles, chrome: "", navSurface: "" },
      cssVariables: { ...values.cssVariables, "--se-chrome": "", "--se-nav-surface": "" },
    });
    expect(rest(resolved[mode])).toEqual(rest(untinted[mode]));
    expect(resolved[mode].roles.chrome).not.toBe(untinted[mode].roles.chrome);
    expect(resolved[mode].roles.navSurface).not.toBe(untinted[mode].roles.navSurface);
  });

  it("keeps navSurface opaque in every combination", () => {
    for (const theme of Object.keys(BUILT_IN_THEMES)) {
      for (const accent of [...ACCENT_IDS, FROM_THEME]) {
        for (const backgroundTint of [true, false]) {
          const values = resolveAppearance(
            { ...DEFAULT_APPEARANCE, lightTheme: theme, darkTheme: theme, accent, backgroundTint },
            BUILT_IN_THEMES,
          );
          for (const mode of ["light", "dark"] as const) {
            const label = `${theme} ${mode} ${accent} ${backgroundTint}`;
            expect(values[mode].roles.navSurface, label).toMatch(/^#[0-9a-f]{6}$/);
          }
        }
      }
    }
  });
});

describe("calculated values", () => {
  it("makes navSurface surface over chrome at 70 %, opaque", () => {
    const { light, dark } = resolveAppearance(
      { ...DEFAULT_APPEARANCE, backgroundTint: false },
      BUILT_IN_THEMES,
    );
    // light: 255 * 0.7 + 247 * 0.3 = 252.6, 255 * 0.7 + 248 * 0.3 = 252.9
    expect(light.roles.navSurface).toBe("#fdfdfd");
    // dark: 26 * 0.7 + 14 * 0.3 = 22.4, 29 * 0.7 + 16 * 0.3 = 25.1
    expect(dark.roles.navSurface).toBe("#161619");
  });
});

describe("the Accent", () => {
  const ownAccent: ColorSet = {
    light: {
      accent: "#7a1f1f",
      onAccent: "#ffffff",
      accentSoft: "#fbeaea",
      accentText: "#7a1f1f",
    },
    dark: {
      accent: "#7a1f1f",
      onAccent: "#ffffff",
      accentSoft: "#3a1515",
      accentText: "#f0a0a0",
    },
  };
  const neutral = BUILT_IN_THEMES["neutral"] as Theme;
  const catalog: ThemeCatalog = {
    ...BUILT_IN_THEMES,
    branded: { ...neutral, id: "branded", name: "Branded", accent: ownAccent },
    darkOnly: {
      version: 1,
      id: "darkOnly",
      name: "Dark only",
      colors: { dark: neutral.colors.dark as ThemeColors },
      accent: ownAccent,
    },
  };
  const branded = { ...DEFAULT_APPEARANCE, lightTheme: "branded", darkTheme: "branded" };

  it("offers six of the eight Color Sets as Accents", () => {
    expect(ACCENT_IDS).toEqual(["blue", "indigo", "violet", "teal", "orange", "grape"]);
    expect(Object.keys(COLOR_SETS).toSorted()).toEqual([...ACCENT_IDS, "green", "pink"].toSorted());
  });

  it("types the built-in Accents as Color Set ids, so a typo fails the typecheck", () => {
    expectTypeOf(ACCENT_IDS).items.toEqualTypeOf<ColorSetId>();
  });

  it("uses blue for From Theme when the Theme has no Accent", () => {
    expect(resolved.light.roles.accent).toBe("#1c6ed5");
    expect(resolved.dark.roles.accentText).toBe("#74b0ff");
  });

  it("uses the Theme's own Accent for From Theme", () => {
    const values = resolveAppearance(branded, catalog);
    expect(values.light.roles.accent).toBe("#7a1f1f");
    expect(values.dark.roles.accentText).toBe("#f0a0a0");
  });

  it("does not take the Accent of a Theme that cannot serve the Color Mode", () => {
    const values = resolveAppearance(
      { ...DEFAULT_APPEARANCE, lightTheme: "darkOnly", darkTheme: "darkOnly" },
      catalog,
    );
    expect(values.light.roles.accent).toBe("#1c6ed5");
    expect(values.dark.roles.accent).toBe("#7a1f1f");
  });

  it.each(ACCENT_IDS)("applies the explicit Accent %s over the Theme's own", (id) => {
    const values = resolveAppearance({ ...branded, accent: id }, catalog);
    const set = COLOR_SETS[id] as ColorSet;
    expect(values.light.roles.accent).toBe(set.light.accent);
    expect(values.dark.roles.accentText).toBe(set.dark.accentText);
  });

  it.each(["nope", "constructor", "__proto__", "toString", "green", "pink"])(
    "displays %s like From Theme",
    (id) => {
      expect(resolveAppearance({ ...branded, accent: id }, catalog)).toEqual(
        resolveAppearance(branded, catalog),
      );
    },
  );

  it("lets white text on the blue fill reach AA in light Color Mode", () => {
    expect(resolved.light.roles.onAccent).toBe("#ffffff");
    expect(contrastRatio("#ffffff", resolved.light.roles.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the data handed to CSS and Mantine", () => {
  it("names every role as a --se-* variable in kebab case", () => {
    const { cssVariables } = resolved.light;
    expect(cssVariables["--se-text-muted"]).toBe("#62626a");
    expect(cssVariables["--se-nav-surface"]).toBe("#f3f7fc");
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
    expect(gray[6], "dimmed, chevrons").toBe("#62626a");
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

describe("the Color Sets handed to Mantine", () => {
  const teal = resolveAppearance({ ...DEFAULT_APPEARANCE, accent: "teal" }, BUILT_IN_THEMES);

  it("produces a Color Set's fill, soft fill, colored text and on-fill text", () => {
    const { colorVariables } = resolved.light;
    expect(colorVariables["--mantine-color-teal-filled"]).toBe("#0b7a6e");
    expect(colorVariables["--mantine-color-teal-light"]).toBe("#e0f5f1");
    expect(colorVariables["--mantine-color-teal-light-color"]).toBe("#0a6c61");
    expect(colorVariables["--mantine-color-teal-outline"]).toBe("#0a6c61");
    expect(colorVariables["--mantine-color-teal-text"]).toBe("#0a6c61");
    expect(colorVariables["--mantine-color-teal-contrast"]).toBe("#ffffff");
  });

  it("calculates the hover and outline values", () => {
    const { colorVariables } = resolved.light;
    // 10 % black over the fill: 122 * 0.9 = 109.8, 110 * 0.9 = 99
    expect(colorVariables["--mantine-color-teal-filled-hover"]).toBe("#0a6e63");
    // 10 % of the fill over the soft fill: 224 * 0.9 + 11 * 0.1 = 202.7
    expect(colorVariables["--mantine-color-teal-light-hover"]).toBe("#cbe9e4");
    expect(colorVariables["--mantine-color-teal-outline-hover"]).toBe("#0a6c6114");
  });

  it("gives a fill with dark on-fill text a lighter hover", () => {
    const neutral = BUILT_IN_THEMES["neutral"] as Theme;
    const catalog: ThemeCatalog = {
      amber: {
        ...neutral,
        id: "amber",
        accent: {
          light: {
            accent: "#f0b429",
            onAccent: "#18181b",
            accentSoft: "#fdf3dc",
            accentText: "#7a5200",
          },
        },
      },
    };
    const values = resolveAppearance({ ...DEFAULT_APPEARANCE, lightTheme: "amber" }, catalog);
    // 10 % white over the fill: 240 * 0.9 + 25.5 = 241.5, 41 * 0.9 + 25.5 = 62.4
    expect(values.light.colorVariables["--mantine-color-accent-filled-hover"]).toBe("#f2bc3e");
  });

  it("publishes the Accent under the fixed key accent, whatever is picked", () => {
    expect(teal.light.colorVariables["--mantine-color-accent-filled"]).toBe("#0b7a6e");
    expect(teal.dark.colorVariables["--mantine-color-accent-light-color"]).toBe("#4fd1bd");
    expect(resolved.light.colorVariables["--mantine-color-accent-filled"]).toBe("#1c6ed5");
  });

  it("makes the primary contrast color the Accent's on-fill text", () => {
    expect(resolved.dark.colorVariables["--mantine-primary-color-contrast"]).toBe("#ffffff");
  });

  it.each(["light", "dark"] as const)("generates ten ordered shades per palette in %s", (mode) => {
    const { palettes } = resolved[mode];
    expect(Object.keys(palettes).toSorted()).toEqual(
      [...Object.keys(COLOR_SETS), "accent"].toSorted(),
    );
    for (const [name, shades] of Object.entries(palettes)) {
      expect(shades, name).toHaveLength(10);
      const darkness = shades.map((shade) => contrastRatio(shade, "#ffffff"));
      expect(darkness, name).toEqual(darkness.toSorted((a, b) => a - b));
    }
  });

  it("puts the fill at shade 6, the primary shade", () => {
    expect(resolved.light.palettes["teal"]?.[6]).toBe("#0b7a6e");
    expect(teal.dark.palettes["accent"]?.[6]).toBe("#0b7a6e");
  });
});

describe("the catalog", () => {
  it("resolves the light and the dark Theme independently", () => {
    const values = resolveAppearance(
      { ...DEFAULT_APPEARANCE, lightTheme: "warm", darkTheme: "cool" },
      BUILT_IN_THEMES,
    );
    expect(values.light.roles.text).toBe("#1c1917");
    expect(values.dark.roles.text).toBe("#e8edf3");
  });

  it("falls back to Neutral for an unknown Theme id", () => {
    const values = resolveAppearance(
      { ...DEFAULT_APPEARANCE, lightTheme: "gone", darkTheme: "gone" },
      BUILT_IN_THEMES,
    );
    expect(values).toEqual(resolved);
  });

  it.each(["constructor", "__proto__", "toString"])(
    "treats %s as an unknown Theme id, not as an object property",
    (id) => {
      const values = resolveAppearance(
        { ...DEFAULT_APPEARANCE, lightTheme: id, darkTheme: id },
        BUILT_IN_THEMES,
      );
      expect(values).toEqual(resolved);
    },
  );

  describe("with a Theme that only has a dark variant", () => {
    const night: Theme = {
      version: 1,
      id: "night",
      name: "Night",
      colors: { dark: { ...neutralDark, text: "#fafafa", canvas: "#000000" } },
    };
    const appearance = { ...DEFAULT_APPEARANCE, lightTheme: "night", darkTheme: "night" };
    const values = resolveAppearance(appearance, { ...BUILT_IN_THEMES, night });

    it("uses that Theme for dark", () => {
      expect(values.dark.roles.text).toBe("#fafafa");
      expect(values.dark.roles.canvas).toBe("#000000");
    });

    it("falls back to Neutral for light", () => {
      expect(values.light).toEqual(resolved.light);
    });

    it("falls back to Neutral even when the catalog does not hold Neutral", () => {
      expect(resolveAppearance(appearance, { night }).light).toEqual(resolved.light);
    });

    it("leaves the stored Theme ids as they are", () => {
      expect(appearance.lightTheme).toBe("night");
      expect(appearance.darkTheme).toBe("night");
    });
  });

  it.each(["neutral", "warm", "cool"])("ships %s in version 1 with both Color Modes", (id) => {
    const theme = BUILT_IN_THEMES[id] as Theme;
    expect(theme.id).toBe(id);
    expect(theme.version).toBe(1);
    expect(Object.keys(theme.colors).toSorted()).toEqual(["dark", "light"]);
  });

  it("refuses a Theme table that lacks a Color Role at compile time", () => {
    // @ts-expect-error `textMuted` and the other roles are missing.
    const incomplete: ThemeColors = { text: "#000000" };
    expect(incomplete.text).toBe("#000000");
  });
});

describe("the Color Mode choices and the fixed appearance", () => {
  it("offers both Color Modes and following the system", () => {
    expect(COLOR_MODE_CHOICES).toEqual(["light", "dark", "system"]);
  });

  it("fixes a light appearance that no system preference can change (ADR 0012)", () => {
    expect(FIXED_APPEARANCE).toEqual({
      lightTheme: "neutral",
      darkTheme: "neutral",
      accent: "fromTheme",
      backgroundTint: true,
      colorMode: "light",
      density: "comfortable",
      fontScale: 100,
    });
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
