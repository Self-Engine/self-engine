// The Northstar, Self-Engine's logo, as data: the faceted star breaking out of its ring, in a
// 128-unit space, and the colors of every picture drawn from it outside the app. The app's own
// mark (`BrandMark`) and every generated file (the desktop icons, GitHub's pictures, the README
// logo) read the geometry from here, so the logo has one source.

/** The four-pointed star with its long north ray. */
export const STAR_PATH = "M64 18Q69.5 64.5 92 70Q69.5 75.5 64 98Q58.5 75.5 36 70Q58.5 64.5 64 18Z";

/** The shaded half of each ray: four triangles, clipped to the star. */
export const FACETS_PATH =
  "M64 70L64 10L124 10ZM64 70L124 70L124 130ZM64 70L64 130L4 130ZM64 70L4 70L4 10Z";

/** The ring the star breaks out of. */
export const RING = { cx: 64, cy: 70, r: 34, strokeWidth: 5 } as const;

/** The square the mark is framed to: the star's tip and the ring's stroke just fit. */
export const CROP = { x: 18, y: 16, size: 92 } as const;

/** How the star, its facets and the ring are painted. */
export interface NorthstarColors {
  readonly starTop: string;
  readonly starBottom: string;
  readonly ring: string;
  readonly ringOpacity: number;
  readonly facet: string;
  readonly facetOpacity: number;
}

/** An opaque icon also owns its background, a gradient from the top left to the bottom right. */
export interface IconColors extends NorthstarColors {
  readonly backgroundStart: string;
  readonly backgroundEnd: string;
}

/**
 * The opaque icons. Terracotta is the brand: the stable app and GitHub. Each desktop channel
 * has its own pair of background and star, so dev, nightly and stable differ in the Dock.
 */
export const ICON_COLORS = {
  terracotta: {
    backgroundStart: "#ec9466",
    backgroundEnd: "#b9532a",
    starTop: "#fffaf6",
    starBottom: "#ffe6d6",
    ring: "#fff6ef",
    ringOpacity: 0.5,
    facet: "#7a3413",
    facetOpacity: 0.22,
  },
  /** A golden star in a night sky. */
  nightBlue: {
    backgroundStart: "#3d3a8c",
    backgroundEnd: "#15143d",
    starTop: "#fff1c9",
    starBottom: "#f2b84b",
    ring: "#b8b4ff",
    ringOpacity: 0.45,
    facet: "#3b2604",
    facetOpacity: 0.28,
  },
  /** A mint star on petrol. */
  petrol: {
    backgroundStart: "#2f8f86",
    backgroundEnd: "#0f4a49",
    starTop: "#f2fffb",
    starBottom: "#a8eedd",
    ring: "#d4fff3",
    ringOpacity: 0.45,
    facet: "#0b3b36",
    facetOpacity: 0.26,
  },
} as const satisfies Record<string, IconColors>;

/**
 * The transparent mark of the README, on GitHub's light and dark page. Light is the app's own
 * light mark. Dark is brighter than the app's dark mark, whose ring all but vanishes on
 * GitHub's near-black page.
 */
export const README_MARK_COLORS = {
  light: {
    starTop: "#f7a062",
    starBottom: "#d06d3d",
    ring: "#c58361",
    ringOpacity: 0.5,
    facet: "#3a1a0c",
    facetOpacity: 0.22,
  },
  dark: {
    starTop: "#ffe2cf",
    starBottom: "#ec9466",
    ring: "#f0a982",
    ringOpacity: 0.7,
    facet: "#3a1a0c",
    facetOpacity: 0.3,
  },
} as const satisfies Record<string, NorthstarColors>;
