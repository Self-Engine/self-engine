import { composite, luminance } from "./color.ts";
import type { Hex, ResolvedColorMode, ThemeColors } from "./roles.ts";
import type { Palette } from "./variants.ts";

function mix(from: Hex, to: Hex, amount: number): Hex {
  return composite(to, from, amount);
}

/** The indices follow what Mantine's stylesheet reads from `gray` in the light scheme. */
function graySlots(table: ThemeColors): Hex[] {
  const hoverOnSurface = composite(table.hover, table.surface);
  return [
    composite(table.hover, table.surface, 0.5),
    hoverOnSurface,
    mix(hoverOnSurface, table.border, 0.5),
    table.border,
    table.borderControl,
    mix(table.borderControl, table.textMuted, 0.5),
    table.textMuted,
    mix(table.textMuted, table.text, 1 / 3),
    mix(table.textMuted, table.text, 2 / 3),
    table.text,
  ];
}

/** The indices follow what Mantine's stylesheet reads from `dark` in the dark scheme. */
function darkSlots(table: ThemeColors): Hex[] {
  return [
    table.text,
    mix(table.text, table.textMuted, 0.5),
    table.textMuted,
    mix(table.textMuted, table.borderControl, 0.5),
    table.borderControl,
    composite(table.hover, table.surface),
    table.surface,
    table.canvas,
    table.chrome,
    mix(table.chrome, "#000000", 0.3),
  ];
}

/**
 * A safety net for Mantine components that read `gray` or `dark` directly. It uses the Theme's
 * table, so the Accent and the Background Tint leave it alone. The sort keeps the tuple in order
 * for imported Themes whose surfaces do not step the way the built-in ones do.
 */
export function neutralPalette(table: ThemeColors, mode: ResolvedColorMode): Palette {
  const slots = mode === "light" ? graySlots(table) : darkSlots(table);
  return slots.toSorted((a, b) => luminance(b) - luminance(a)) as unknown as Palette;
}
