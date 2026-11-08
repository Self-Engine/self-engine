import { createTheme, type MantineThemeOverride } from "@mantine/core";
import { FONT_FAMILY, type ResolvedAppearance } from "../core/index.ts";

/**
 * Mantine's theme object for the resolved appearance. Spacing, radii, font sizes, line heights,
 * headings and shadows stay Mantine's own scales, which are the look of prototype B3 and are
 * already in `rem`; there is no second token system beside them. Setting `fontFamily` also sets
 * the headings, because Mantine copies it to them when merging.
 */
export function mantineTheme(resolved: ResolvedAppearance): MantineThemeOverride {
  return createTheme({
    colors: { gray: resolved.light.neutralPalette, dark: resolved.dark.neutralPalette },
    components: resolved.layout.mantineComponents,
    defaultRadius: "md",
    focusRing: "auto",
    fontFamily: FONT_FAMILY,
    fontFamilyMonospace: FONT_FAMILY,
    respectReducedMotion: true,
  });
}
