import {
  createTheme,
  defaultVariantColorsResolver,
  type MantineThemeOverride,
  parseThemeColor,
  type VariantColorsResolver,
} from "@mantine/core";
import {
  ACCENT_PALETTE,
  COLOR_SETS,
  FILL_SHADE,
  FONT_FAMILY,
  type ResolvedAppearance,
  type ResolvedColorMode,
} from "../core/index.ts";

const COLOR_SET_PALETTES: ReadonlySet<string> = new Set([
  ...Object.keys(COLOR_SETS),
  ACCENT_PALETTE,
]);

/** Filled variants of a Color Set carry its on-fill text instead of Mantine's default white. */
const variantColorResolver: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input);
  if (input.variant !== "filled") return colors;
  const parsed = parseThemeColor({ color: input.color, theme: input.theme });
  const isColorSet = parsed.shade === undefined && COLOR_SET_PALETTES.has(parsed.color);
  return isColorSet
    ? { ...colors, color: `var(--mantine-color-${parsed.color}-contrast)` }
    : colors;
};

/**
 * Mantine's theme object for the resolved appearance. Spacing, radii, font sizes, line heights,
 * headings and shadows stay Mantine's own scales, which are the look of prototype B3 and are
 * already in `rem`; there is no second token system beside them. Setting `fontFamily` also sets
 * the headings, because Mantine copies it to them when merging.
 *
 * Mantine writes numbered shades once for both schemes, so the Color Set palettes follow the
 * active `scheme`. `gray` and `dark` each belong to one scheme and are always both present.
 */
export function mantineTheme(
  resolved: ResolvedAppearance,
  scheme: ResolvedColorMode,
): MantineThemeOverride {
  return createTheme({
    colors: {
      ...resolved[scheme].palettes,
      gray: resolved.light.neutralPalette,
      dark: resolved.dark.neutralPalette,
    },
    components: resolved.layout.mantineComponents,
    defaultRadius: "md",
    focusRing: "auto",
    fontFamily: FONT_FAMILY,
    fontFamilyMonospace: FONT_FAMILY,
    primaryColor: ACCENT_PALETTE,
    primaryShade: FILL_SHADE,
    respectReducedMotion: true,
    variantColorResolver,
  });
}
