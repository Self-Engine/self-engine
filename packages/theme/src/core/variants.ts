import { composite, luminance } from "./color.ts";
import type { AccentColors, Hex, ResolvedColorMode } from "./roles.ts";

/** Ten shades from lightest to darkest, the shape Mantine's palettes have. */
export type Palette = readonly [Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex];

const FILL_HOVER_SHIFT = 0.1;
const SOFT_HOVER_FILL = 0.1;
/** The alpha of the outline hover as two hex digits: about 8 %. */
const OUTLINE_HOVER_ALPHA = "14";
const PALETTE_DARKEST_SHIFT = 0.5;
/** The shade that holds the fill. The Mantine binding sets this as its primary shade. */
export const FILL_SHADE = 6;

/** The fill moved away from its text, so a hover can only raise the contrast. */
export function fillHover(fill: Hex, onFill: Hex): Hex {
  const away = luminance(onFill) > luminance(fill) ? "#000000" : "#ffffff";
  return composite(away, fill, FILL_HOVER_SHIFT);
}

export function softHover(fill: Hex, soft: Hex): Hex {
  return composite(fill, soft, SOFT_HOVER_FILL);
}

/** Translucent, because an outline button has no background of its own. */
export function outlineHover(coloredText: Hex): Hex {
  return `${coloredText}${OUTLINE_HOVER_ALPHA}`;
}

/** Mantine's per-color variables, for the palette key `name`. */
export function colorSetVariables(
  name: string,
  set: AccentColors,
): Readonly<Record<`--mantine-${string}`, Hex>> {
  const prefix = `--mantine-color-${name}` as const;
  return {
    [`${prefix}-filled`]: set.accent,
    [`${prefix}-filled-hover`]: fillHover(set.accent, set.onAccent),
    [`${prefix}-light`]: set.accentSoft,
    [`${prefix}-light-hover`]: softHover(set.accent, set.accentSoft),
    [`${prefix}-light-color`]: set.accentText,
    [`${prefix}-outline`]: set.accentText,
    [`${prefix}-outline-hover`]: outlineHover(set.accentText),
    [`${prefix}-text`]: set.accentText,
    [`${prefix}-contrast`]: set.onAccent,
  };
}

/** The shades around the fill. A safety net for code that reads a numbered shade. */
export function colorSetPalette(set: AccentColors, mode: ResolvedColorMode): Palette {
  const lightest = mode === "light" ? set.accentSoft : set.accentText;
  const darkest =
    mode === "light" ? composite("#000000", set.accent, PALETTE_DARKEST_SHIFT) : set.accentSoft;
  const lastShade = 9;
  return Array.from({ length: lastShade + 1 }, (_, shade) =>
    shade <= FILL_SHADE
      ? composite(set.accent, lightest, shade / FILL_SHADE)
      : composite(darkest, set.accent, (shade - FILL_SHADE) / (lastShade - FILL_SHADE)),
  ) as unknown as Palette;
}
