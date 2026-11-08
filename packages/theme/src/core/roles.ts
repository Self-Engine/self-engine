/** An sRGB color: `#rrggbb`, or `#rrggbbaa` for the one translucent role. */
export type Hex = `#${string}`;

export const COLOR_MODES = ["light", "dark"] as const;
export type ResolvedColorMode = (typeof COLOR_MODES)[number];

/** Every Color Role a Theme table has to fill. A role added here fails the typecheck of each table. */
export const THEME_ROLES = [
  "chrome",
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
] as const;
export type ThemeRole = (typeof THEME_ROLES)[number];

/** The role the engine calculates instead of reading it from a table. */
export type CalculatedRole = "navSurface";

export type ColorRole = ThemeRole | CalculatedRole;

/** The four roles of a Color Set, here under their Accent names. */
export type ColorSetRole = "accent" | "onAccent" | "accentSoft" | "accentText";

export type ThemeColors = Readonly<Record<ThemeRole, Hex>>;
export type ColorSetColors = Readonly<Record<ColorSetRole, Hex>>;
export type FinalColors = Readonly<Record<ColorRole | ColorSetRole, Hex>>;

/** The `--se-*` name of a Color Role: `textMuted` becomes `--se-text-muted`. */
export function roleVariable(role: ColorRole | ColorSetRole): `--se-${string}` {
  return `--se-${role.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** A CSS color that follows a Color Role through its variable, whatever the appearance. */
export function roleColor(role: ColorRole | ColorSetRole): string {
  return `var(${roleVariable(role)})`;
}
