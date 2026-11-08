import { COLOR_SETS, DEFAULT_COLOR_SET, DEFAULT_THEME, type ThemeCatalog } from "./catalog.ts";
import { composite } from "./color.ts";
import { type NeutralPalette, neutralPalette } from "./neutral-palette.ts";
import {
  COLOR_MODES,
  type FinalColors,
  type Hex,
  type ResolvedColorMode,
  roleVariable,
  type ThemeColors,
} from "./roles.ts";

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
  /** Mantine's `gray` tuple for light, its `dark` tuple for dark. */
  readonly neutralPalette: NeutralPalette;
}

export type ResolvedAppearance = Readonly<Record<ResolvedColorMode, ModeValues>>;

const NAV_SURFACE_OPACITY = 0.7;

function themeColors(
  appearance: Appearance,
  catalog: ThemeCatalog,
  mode: ResolvedColorMode,
): ThemeColors {
  const id = mode === "light" ? appearance.lightTheme : appearance.darkTheme;
  return catalog[id]?.colors[mode] ?? DEFAULT_THEME.colors[mode];
}

function cssVariables(roles: FinalColors): ModeValues["cssVariables"] {
  return Object.fromEntries(
    Object.entries(roles).map(([role, value]) => [roleVariable(role as keyof FinalColors), value]),
  );
}

function mantineVariables(
  roles: FinalColors,
  mode: ResolvedColorMode,
): ModeValues["mantineVariables"] {
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

function modeValues(
  appearance: Appearance,
  catalog: ThemeCatalog,
  mode: ResolvedColorMode,
): ModeValues {
  const table = themeColors(appearance, catalog, mode);
  const roles: FinalColors = {
    ...table,
    navSurface: composite(table.surface, table.chrome, NAV_SURFACE_OPACITY),
    ...(COLOR_SETS[appearance.accent] ?? DEFAULT_COLOR_SET)[mode],
  };
  return {
    roles,
    cssVariables: cssVariables(roles),
    mantineVariables: mantineVariables(roles, mode),
    neutralPalette: neutralPalette(table, mode),
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
