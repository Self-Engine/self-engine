import { describe, expect, it } from "vite-plus/test";
import {
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  type FinalColors,
  resolveAppearance,
  resolveColorMode,
  type Theme,
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
