import {
  ACCENT_IDS,
  COLOR_SETS,
  DEFAULT_COLOR_SET,
  DEFAULT_THEME,
  type Theme,
  type ThemeCatalog,
} from "./catalog.ts";
import { composite, mixOklab } from "./color.ts";
import { type Density, type FontScale, type LayoutValues, resolveLayout } from "./layout.ts";
import { type ModuleColor, moduleColorCss, moduleColors } from "./module-colors.ts";
import { neutralPalette } from "./neutral-palette.ts";
import {
  type ColorSetColors,
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
  readonly density: Density;
  readonly fontScale: FontScale;
}

export const DEFAULT_APPEARANCE: Appearance = {
  lightTheme: "neutral",
  darkTheme: "neutral",
  accent: FROM_THEME,
  backgroundTint: true,
  colorMode: "system",
  density: "comfortable",
  fontScale: 100,
};

/** The final values for one Color Mode: plain data for CSS, Mantine and the contrast check. */
export interface ColorModeValues {
  readonly roles: FinalColors;
  readonly cssVariables: Readonly<Record<`--se-${string}`, Hex>>;
  readonly mantineVariables: Readonly<Record<`--mantine-${string}`, Hex>>;
  /** Mantine's `gray` tuple for light, its `dark` tuple for dark. */
  readonly neutralPalette: Palette;
  /** Mantine's per-color variables for each Color Set and for the palette key `accent`. */
  readonly colorVariables: Readonly<Record<`--mantine-${string}`, Hex>>;
  /** The palettes for Mantine's `theme.colors`, by key. */
  readonly palettes: Readonly<Record<string, Palette>>;
  /** Every Color Set as a Module Color, by Color Set name. */
  readonly moduleColors: Readonly<Record<string, ModuleColor>>;
  /** The rules that turn `data-module-color` into the `--se-module*` variables. */
  readonly moduleColorCss: string;
}

export type ResolvedAppearance = Readonly<Record<ResolvedColorMode, ColorModeValues>> & {
  readonly layout: LayoutValues;
};

const NAV_SURFACE_OPACITY = 0.7;
const BACKGROUND_TINT_STRENGTH = 0.15;

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
): ColorSetColors {
  const id = ACCENT_IDS.find((accentId) => accentId === setting);
  const explicit = id === undefined ? undefined : COLOR_SETS[id];
  return (explicit ?? themeAccent ?? DEFAULT_COLOR_SET)[mode] ?? DEFAULT_COLOR_SET[mode];
}

function cssVariables(roles: FinalColors): ColorModeValues["cssVariables"] {
  return Object.fromEntries(
    Object.entries(roles).map(([role, value]) => [roleVariable(role as keyof FinalColors), value]),
  );
}

function mantineVariables(
  roles: FinalColors,
  mode: ResolvedColorMode,
): ColorModeValues["mantineVariables"] {
  return {
    // Mantine paints inputs, cards and popovers with white, in the light scheme only.
    ...(mode === "light" && { "--mantine-color-white": roles.surface }),
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
  accent: ColorSetColors,
): readonly (readonly [string, ColorSetColors])[] {
  const sets = Object.entries(COLOR_SETS).map(([id, set]) => [id, set[mode]] as const);
  return [...sets, [ACCENT_PALETTE, accent]];
}

function colorModeValues(
  appearance: Appearance,
  catalog: ThemeCatalog,
  mode: ResolvedColorMode,
): ColorModeValues {
  const { colors: table, accent } = servingTheme(appearance, catalog, mode);
  const accentSet = accentColors(appearance.accent, accent, mode);
  const chrome = appearance.backgroundTint
    ? mixOklab(table.chrome, accentSet.accent, BACKGROUND_TINT_STRENGTH)
    : table.chrome;
  const roles: FinalColors = {
    ...table,
    chrome,
    navSurface: composite(table.surface, chrome, NAV_SURFACE_OPACITY),
    ...accentSet,
  };
  const sets = paletteSets(mode, accentSet);
  const modules = moduleColors(mode);
  return {
    roles,
    cssVariables: cssVariables(roles),
    mantineVariables: mantineVariables(roles, mode),
    neutralPalette: neutralPalette(table, mode),
    colorVariables: Object.assign(
      { "--mantine-primary-color-contrast": accentSet.onAccent },
      ...sets.map(([name, set]) => colorSetVariables(name, set)),
    ),
    palettes: Object.fromEntries(sets.map(([name, set]) => [name, colorSetPalette(set, mode)])),
    moduleColors: modules,
    moduleColorCss: moduleColorCss(modules),
  };
}

/** Appearance settings and a catalog in, the final values for both Color Modes out. */
export function resolveAppearance(
  appearance: Appearance,
  catalog: ThemeCatalog,
): ResolvedAppearance {
  const [light, dark] = COLOR_MODES.map((mode) => colorModeValues(appearance, catalog, mode)) as [
    ColorModeValues,
    ColorModeValues,
  ];
  return { light, dark, layout: resolveLayout(appearance.density, appearance.fontScale) };
}

/** Light or dark for the `colorMode` setting and the system's current preference. */
export function resolveColorMode(
  colorMode: ColorMode,
  systemPrefersDark: boolean,
): ResolvedColorMode {
  if (colorMode !== "system") return colorMode;
  return systemPrefersDark ? "dark" : "light";
}
