// Density and font scale are per device and never arrive from a newer app version through
// sync, so unlike Theme and Accent ids their types stay closed.

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

/** The five steps of the font scale, in percent of the browser's base font size. */
export const FONT_SCALES = [87.5, 93.75, 100, 106.25, 112.5] as const;
export type FontScale = (typeof FONT_SCALES)[number];

type DensityVariable = "--se-row-height" | "--se-padding" | "--se-gap";

/** In `rem`, so that the font scale resizes them too. */
export const DENSITY_VARIABLES: Readonly<
  Record<Density, Readonly<Record<DensityVariable, `${number}rem`>>>
> = {
  comfortable: { "--se-row-height": "2.75rem", "--se-padding": "1rem", "--se-gap": "0.25rem" },
  compact: { "--se-row-height": "2.125rem", "--se-padding": "0.75rem", "--se-gap": "0.125rem" },
};

const DENSITY_CSS = DENSITIES.map((density) => {
  const declarations = Object.entries(DENSITY_VARIABLES[density])
    .map(([name, value]) => `${name}:${value};`)
    .join("");
  return `:root[data-density="${density}"]{${declarations}}`;
}).join("");

/**
 * Mantine's size `sm`, its default, is taller than a compact row, and `xs` fits. Defaults only,
 * so a control with an explicit `size` keeps it. `Input` also covers every input built on it.
 */
const COMPACT_CONTROLS = {
  Input: { defaultProps: { size: "xs" } },
  Button: { defaultProps: { size: "xs" } },
} as const;

export interface LayoutValues {
  /** The value for `data-density` on the root element. */
  readonly density: Density;
  /** The rules that turn `data-density` into the `--se-*` Density variables. */
  readonly densityCss: string;
  /** The value for `font-size` on the root element; Mantine's `rem` sizes grow along with it. */
  readonly rootFontSize: `${FontScale}%`;
  /** The entries for Mantine's `theme.components`. */
  readonly mantineComponents: Readonly<Partial<typeof COMPACT_CONTROLS>>;
}

export function resolveLayout(density: Density, fontScale: FontScale): LayoutValues {
  return {
    density,
    densityCss: DENSITY_CSS,
    rootFontSize: `${fontScale}%`,
    mantineComponents: density === "compact" ? COMPACT_CONTROLS : {},
  };
}
