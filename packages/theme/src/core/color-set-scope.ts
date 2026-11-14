// The scope that turns a Color Set name into CSS variables: `data-color-set="teal"` sets the four
// `--se-color-set*` variables on its element. Module Colors and the colors of entries use the same
// scope, so what is inside needs no knowledge of which one it is.

import type { ColorSetName } from "../names/list.ts";
import { COLOR_SETS } from "./catalog.ts";
import { cssDeclarations } from "./css.ts";
import type { ColorSetRole, Hex, ResolvedColorMode } from "./roles.ts";

const SCOPE_VARIABLES = {
  accent: "--se-color-set",
  onAccent: "--se-color-set-on",
  accentSoft: "--se-color-set-soft",
  accentText: "--se-color-set-text",
} as const satisfies Readonly<Record<ColorSetRole, `--se-${string}`>>;

type ScopeVariable = (typeof SCOPE_VARIABLES)[ColorSetRole];

/** What one Color Set sets inside its scope. */
export type ColorSetScope = Readonly<Record<ScopeVariable, Hex>>;

/** Every Color Set as a scope, by Color Set name. */
export type ColorSetScopes = Readonly<Record<ColorSetName, ColorSetScope>>;

/** Every Color Set as a scope for this Color Mode, by Color Set name. */
export function colorSetScopes(mode: ResolvedColorMode): ColorSetScopes {
  // `Object.fromEntries` keys by any text; the catalog's keys are exactly the Color Set names.
  return Object.fromEntries(
    Object.entries(COLOR_SETS).map(([name, set]) => {
      const { accent, onAccent, accentSoft, accentText } = set[mode];
      const color: ColorSetScope = {
        [SCOPE_VARIABLES.accent]: accent,
        [SCOPE_VARIABLES.onAccent]: onAccent,
        [SCOPE_VARIABLES.accentSoft]: accentSoft,
        [SCOPE_VARIABLES.accentText]: accentText,
      };
      return [name, color];
    }),
  ) as ColorSetScopes;
}

/** A CSS color that follows a role of the Color Set of the nearest `data-color-set` scope. */
export function colorSetColor(role: ColorSetRole): string {
  return `var(${SCOPE_VARIABLES[role]})`;
}

/**
 * One rule per Color Set. Each sets the variables on the scoped element itself, so scopes can
 * sit side by side or nest, and what is inside needs no knowledge of the color.
 */
export function colorSetScopeCss(colors: ColorSetScopes): string {
  return Object.entries(colors)
    .map(([name, color]) => `[data-color-set="${name}"]{${cssDeclarations(color)}}`)
    .join("");
}
