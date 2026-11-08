import { BASE_LANGUAGE, type Language, LANGUAGE_TAGS, LANGUAGES } from "@self-engine/i18n";
import {
  ACCENT_IDS,
  type Appearance,
  BUILT_IN_THEMES,
  COLOR_MODES,
  type ColorMode,
  DEFAULT_APPEARANCE,
  DENSITIES,
  FONT_SCALES,
  FROM_THEME,
} from "@self-engine/theme";
import type { Preview } from "@storybook/react-vite";

/** Independent of the browser's system preference, so every machine renders the same (ADR 0012). */
const FIXED_APPEARANCE: Appearance = { ...DEFAULT_APPEARANCE, colorMode: "light" };

const COLOR_MODE_OPTIONS: readonly ColorMode[] = [...COLOR_MODES, "system"];
const ACCENT_OPTIONS: readonly string[] = [FROM_THEME, ...ACCENT_IDS];
const TINT_ON = "on";
const TINT_OFF = "off";

interface SwitchItem {
  readonly value: string;
  readonly title: string;
}

function toolbarSwitch(title: string, items: readonly SwitchItem[]) {
  return { description: title, toolbar: { title, items: [...items], dynamicTitle: true } };
}

/** Every option comes from the engine or the i18n package, so a new one appears by itself. */
export const globalTypes = {
  theme: toolbarSwitch(
    "Theme",
    Object.values(BUILT_IN_THEMES).map(({ id, name }) => ({ value: id, title: name })),
  ),
  accent: toolbarSwitch(
    "Accent",
    ACCENT_OPTIONS.map((id) => ({ value: id, title: id === FROM_THEME ? "From Theme" : id })),
  ),
  colorMode: toolbarSwitch(
    "Color Mode",
    COLOR_MODE_OPTIONS.map((mode) => ({ value: mode, title: mode })),
  ),
  backgroundTint: toolbarSwitch("Background Tint", [
    { value: TINT_ON, title: "Tint on" },
    { value: TINT_OFF, title: "Tint off" },
  ]),
  density: toolbarSwitch(
    "Density",
    DENSITIES.map((density) => ({ value: density, title: density })),
  ),
  fontScale: toolbarSwitch(
    "Font scale",
    FONT_SCALES.map((scale) => ({ value: String(scale), title: `${scale} %` })),
  ),
  language: toolbarSwitch(
    "App Language",
    LANGUAGE_TAGS.map((tag) => ({ value: tag, title: LANGUAGES[tag].name })),
  ),
} satisfies Preview["globalTypes"];

/** The toolbar's starting values, which are also the appearance story tests run in. */
export const initialGlobals = {
  theme: FIXED_APPEARANCE.lightTheme,
  accent: FIXED_APPEARANCE.accent,
  colorMode: FIXED_APPEARANCE.colorMode,
  backgroundTint: FIXED_APPEARANCE.backgroundTint ? TINT_ON : TINT_OFF,
  density: FIXED_APPEARANCE.density,
  fontScale: String(FIXED_APPEARANCE.fontScale),
  language: BASE_LANGUAGE,
} satisfies Record<keyof typeof globalTypes, string>;

type Globals = Readonly<Record<string, unknown>>;

/** Globals are plain text once they pass through the URL, and a URL can hold anything. */
function chosen<Option extends string | number>(
  options: readonly Option[],
  value: unknown,
  fallback: Option,
): Option {
  return options.find((option) => String(option) === value) ?? fallback;
}

/** One Theme switch sets both the light and the dark Theme. */
export function appearanceOf(globals: Globals): Appearance {
  const theme = chosen(Object.keys(BUILT_IN_THEMES), globals["theme"], FIXED_APPEARANCE.lightTheme);
  return {
    lightTheme: theme,
    darkTheme: theme,
    accent: chosen(ACCENT_OPTIONS, globals["accent"], FIXED_APPEARANCE.accent),
    colorMode: chosen(COLOR_MODE_OPTIONS, globals["colorMode"], FIXED_APPEARANCE.colorMode),
    backgroundTint: globals["backgroundTint"] !== TINT_OFF,
    density: chosen(DENSITIES, globals["density"], FIXED_APPEARANCE.density),
    fontScale: chosen(FONT_SCALES, globals["fontScale"], FIXED_APPEARANCE.fontScale),
  };
}

export function languageOf(globals: Globals): Language {
  return chosen(LANGUAGE_TAGS, globals["language"], BASE_LANGUAGE);
}
