import { COLOR_SETS } from "./catalog.ts";
import type { AccentRole, Hex, ResolvedColorMode } from "./roles.ts";

const MODULE_VARIABLES = {
  accent: "--se-module",
  onAccent: "--se-module-on",
  accentSoft: "--se-module-soft",
  accentText: "--se-module-text",
} as const satisfies Readonly<Record<AccentRole, `--se-${string}`>>;

type ModuleVariable = (typeof MODULE_VARIABLES)[AccentRole];

/** What one Module Color sets inside its scope. */
export type ModuleColor = Readonly<Record<ModuleVariable, Hex>>;

/** Every Color Set as a Module Color for this Color Mode, by Color Set name. */
export function moduleColors(mode: ResolvedColorMode): Readonly<Record<string, ModuleColor>> {
  return Object.fromEntries(
    Object.entries(COLOR_SETS).map(([name, set]) => {
      const { accent, onAccent, accentSoft, accentText } = set[mode];
      const color: ModuleColor = {
        [MODULE_VARIABLES.accent]: accent,
        [MODULE_VARIABLES.onAccent]: onAccent,
        [MODULE_VARIABLES.accentSoft]: accentSoft,
        [MODULE_VARIABLES.accentText]: accentText,
      };
      return [name, color];
    }),
  );
}

/**
 * One rule per Module Color. Each sets the variables on the scoped element itself, so scopes can
 * sit side by side or nest, and what is inside needs no knowledge of the color.
 */
export function moduleColorCss(colors: Readonly<Record<string, ModuleColor>>): string {
  return Object.entries(colors)
    .map(([name, color]) => {
      const declarations = Object.entries(color)
        .map(([variable, value]) => `${variable}:${value};`)
        .join("");
      return `[data-module-color="${name}"]{${declarations}}`;
    })
    .join("");
}
