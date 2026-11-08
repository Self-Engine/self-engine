import {
  ACCENT_IDS,
  COLOR_SETS,
  DEFAULT_COLOR_SET,
  DEFAULT_THEME,
  type Theme,
  type ThemeCatalog,
} from "./catalog.ts";
import { composite } from "./color.ts";
import {
  type AccentColors,
  COLOR_MODES,
  type FinalColors,
  type Hex,
  type ResolvedColorMode,
  roleVariable,
  type ThemeColors,
} from "./roles.ts";
import { colorSetPalette, colorSetVariables, type Palette } from "./variants.ts";

export type ColorMode = ResolvedColorMode | "system";

/** The `accent` setting that uses the Theme's own Accent, or blue if it has none. */
export const FROM_THEME = "fromTheme";

/** The appearance settings the engine reads. Theme and Accent ids stay open strings. */
export interface Appearance {
  readonly lightTheme: string;
  readonly darkTheme: string;
  readonly accent: string;
  readonly backgroundTint: boolean;
  readonly colorMode: ColorMode;
}

export const DEFAULT_APPEARANCE: Appearance = {
  lightTheme: "neutral",
  darkTheme: "neutral",
  accent: FROM_THEME,
  backgroundTint: true,
  colorMode: "system",
};

/** The final values for one Color Mode: plain data for CSS, Mantine and the contrast check. */
export interface ModeValues {
  readonly roles: FinalColors;
  readonly cssVariables: Readonly<Record<`--se-${string}`, Hex>>;
  readonly mantineVariables: Readonly<Record<`--mantine-${string}`, Hex>>;
  /** Mantine's per-color variables for each Color Set and for the palette key `accent`. */
  readonly colorVariables: Readonly<Record<`--mantine-${string}`, Hex>>;
  /** The palettes for Mantine's `theme.colors`, by key. */
  readonly palettes: Readonly<Record<string, Palette>>;
}

export type ResolvedAppearance = Readonly<Record<ResolvedColorMode, ModeValues>>;

const NAV_SURFACE_OPACITY = 0.7;

/** The fixed palette key of the Accent. Mantine's `primaryColor` has to name a palette. */
export const ACCENT_PALETTE = "accent";

/** The Theme that serves a Color Mode: the chosen one if it can, else the default Theme. */
function servingTheme(
  appearance: Appearance,
  catalog: ThemeCatalog,
  mode: ResolvedColorMode,
): { readonly colors: ThemeColors; readonly accent: Theme["accent"] } {
  const id = mode === "light" ? appearance.lightTheme : appearance.darkTheme;
  // A stored id is open text, so a name like "constructor" must not find an inherited property.
  const theme = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
  const colors = theme?.colors[mode];
  return colors === undefined
    ? { colors: DEFAULT_THEME.colors[mode], accent: undefined }
    : { colors, accent: theme?.accent };
}

/** An id that is no selectable Accent, also a stored one from a newer app, means "From Theme". */
function accentColors(
  setting: string,
  themeAccent: Theme["accent"],
  mode: ResolvedColorMode,
): AccentColors {
  const explicit = ACCENT_IDS.includes(setting) ? COLOR_SETS[setting] : undefined;
  return (explicit ?? themeAccent ?? DEFAULT_COLOR_SET)[mode] ?? DEFAULT_COLOR_SET[mode];
}

function cssVariables(roles: FinalColors): ModeValues["cssVariables"] {
  return Object.fromEntries(
    Object.entries(roles).map(([role, value]) => [roleVariable(role as keyof FinalColors), value]),
  );
}

function mantineVariables(roles: FinalColors): ModeValues["mantineVariables"] {
  return {
    "--mantine-color-body": roles.canvas,
    "--mantine-color-text": roles.text,
    "--mantine-color-bright": roles.text,
    "--mantine-color-dimmed": roles.textMuted,
    "--mantine-color-placeholder": roles.textMuted,
    "--mantine-color-anchor": roles.accentText,
    "--mantine-color-error": roles.errorText,
    "--mantine-color-success": roles.successText,
    "--mantine-color-default": roles.surface,
    "--mantine-color-default-hover": roles.hover,
    "--mantine-color-default-color": roles.text,
    "--mantine-color-default-border": roles.borderControl,
  };
}

/** Each palette key with the colors it stands for in this Color Mode. */
function paletteSets(
  mode: ResolvedColorMode,
  accent: AccentColors,
): readonly (readonly [string, AccentColors])[] {
  const sets = Object.entries(COLOR_SETS).map(([id, set]) => [id, set[mode]] as const);
  return [...sets, [ACCENT_PALETTE, accent]];
}

function modeValues(
  appearance: Appearance,
  catalog: ThemeCatalog,
  mode: ResolvedColorMode,
): ModeValues {
  const { colors: table, accent } = servingTheme(appearance, catalog, mode);
  const accentSet = accentColors(appearance.accent, accent, mode);
  const roles: FinalColors = {
    ...table,
    navSurface: composite(table.surface, table.chrome, NAV_SURFACE_OPACITY),
    ...accentSet,
  };
  const sets = paletteSets(mode, accentSet);
  return {
    roles,
    cssVariables: cssVariables(roles),
    mantineVariables: mantineVariables(roles),
    colorVariables: Object.assign(
      { "--mantine-primary-color-contrast": accentSet.onAccent },
      ...sets.map(([name, set]) => colorSetVariables(name, set)),
    ),
    palettes: Object.fromEntries(sets.map(([name, set]) => [name, colorSetPalette(set, mode)])),
  };
}

/** Appearance settings and a catalog in, the final values for both Color Modes out. */
export function resolveAppearance(
  appearance: Appearance,
  catalog: ThemeCatalog,
): ResolvedAppearance {
  const [light, dark] = COLOR_MODES.map((mode) => modeValues(appearance, catalog, mode)) as [
    ModeValues,
    ModeValues,
  ];
  return { light, dark };
}

/** Light or dark for the `colorMode` setting and the system's current preference. */
export function resolveColorMode(
  colorMode: ColorMode,
  systemPrefersDark: boolean,
): ResolvedColorMode {
  if (colorMode !== "system") return colorMode;
  return systemPrefersDark ? "dark" : "light";
}
