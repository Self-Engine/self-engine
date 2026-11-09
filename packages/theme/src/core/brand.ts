import type { Hex, ResolvedColorMode } from "./roles.ts";

export type BrandVariables = Readonly<Record<`--se-brand-${string}`, Hex>>;

/**
 * The colors of the Northstar logo. They are the brand's own, so neither a Theme nor the Accent
 * changes them, only the Color Mode. Not Color Roles: nothing but the mark may use them.
 */
export const BRAND_VARIABLES: Readonly<Record<ResolvedColorMode, BrandVariables>> = {
  light: {
    "--se-brand-star-top": "#f7a062",
    "--se-brand-star-bottom": "#d06d3d",
    "--se-brand-ring": "#c5836180",
    "--se-brand-facets": "#3a1a0c38",
  },
  dark: {
    "--se-brand-star-top": "#ffe2cf",
    "--se-brand-star-bottom": "#e0855a",
    "--se-brand-ring": "#e0855a80",
    "--se-brand-facets": "#3a1a0c4d",
  },
};
