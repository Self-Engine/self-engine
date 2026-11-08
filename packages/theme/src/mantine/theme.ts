import { createTheme, type MantineThemeOverride } from "@mantine/core";
import type { ResolvedAppearance } from "../core/index.ts";

/**
 * Mantine's theme object for the resolved appearance. Spacing, radii, font sizes, line heights,
 * headings and shadows stay Mantine's own scales, which are the look of prototype B3 and are
 * already in `rem`; there is no second token system beside them.
 */
export function mantineTheme(resolved: ResolvedAppearance): MantineThemeOverride {
  return createTheme({
    colors: { gray: resolved.light.neutralPalette, dark: resolved.dark.neutralPalette },
    defaultRadius: "md",
    focusRing: "auto",
    respectReducedMotion: true,
  });
}
