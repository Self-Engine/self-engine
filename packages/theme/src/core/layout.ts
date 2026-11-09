// Density and font scale are per device and never arrive from a newer app version through
// sync, so unlike Theme and Accent ids their types stay closed.

import { cssDeclarations } from "./css.ts";

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

/** The five steps of the font scale, in percent of the app's normal size. */
export const FONT_SCALES = [87.5, 93.75, 100, 106.25, 112.5] as const;
export type FontScale = (typeof FONT_SCALES)[number];

type DensityVariable = "--se-row-height" | "--se-padding" | "--se-gap";

/** At the 100 % font scale. `DENSITY_CSS` multiplies them by the scale, as Mantine does its own. */
export const DENSITY_VARIABLES: Readonly<
  Record<Density, Readonly<Record<DensityVariable, `${number}rem`>>>
> = {
  comfortable: { "--se-row-height": "2.75rem", "--se-padding": "1rem", "--se-gap": "0.25rem" },
  compact: { "--se-row-height": "2.125rem", "--se-padding": "0.75rem", "--se-gap": "0.125rem" },
};

function scaledDensityVariables(density: Density): Readonly<Record<DensityVariable, string>> {
  return Object.fromEntries(
    Object.entries(DENSITY_VARIABLES[density]).map(([name, value]) => [
      name,
      `calc(${value} * var(--mantine-scale))`,
    ]),
  ) as Record<DensityVariable, string>;
}

const DENSITY_CSS = DENSITIES.map(
  (density) => `:root[data-density="${density}"]{${cssDeclarations(scaledDensityVariables(density))}}`,
).join("");

export interface LayoutValues {
  /** The value for `data-density` on the root element. */
  readonly density: Density;
  /** The rules that turn `data-density` into the `--se-*` Density variables. */
  readonly densityCss: string;
  /**
   * Mantine's `theme.scale`. The root element stays at 100 %, because Mantine's resize handling
   * writes measured pixels back assuming 16 px per `rem`.
   */
  readonly scale: number;
}

export function resolveLayout(density: Density, fontScale: FontScale): LayoutValues {
  return {
    density,
    densityCss: DENSITY_CSS,
    scale: fontScale / 100,
  };
}
