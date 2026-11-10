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
  roleColor,
} from "../core/index.ts";

const COLOR_SET_PALETTES: ReadonlySet<string> = new Set([
  ...Object.keys(COLOR_SETS),
  ACCENT_PALETTE,
]);

/**
 * Mantine's size `sm`, its default, is taller than a compact row, and `xs` fits. Defaults only,
 * so a control with an explicit `size` keeps it. `Input` also covers every input built on it.
 */
const COMPACT_CONTROLS = {
  Input: { defaultProps: { size: "xs" } },
  Button: { defaultProps: { size: "xs" } },
};

const SURFACE_RAISED = { backgroundColor: roleColor("surfaceRaised") };

/** The header is sticky and paints its own background over the content's. */
const RAISED_DIALOG = { styles: { content: SURFACE_RAISED, header: SURFACE_RAISED } };

/**
 * The one place where Mantine's choice contradicts a Color Role: a floating layer has to sit above
 * the content. The dropdown's own entry, because Menu and HoverCard read their `theme.components`
 * styles under their own names and would miss one on `Popover`.
 */
const FLOATING_LAYERS = {
  PopoverDropdown: { defaultProps: { styles: { dropdown: SURFACE_RAISED } } },
  Modal: RAISED_DIALOG,
  Drawer: RAISED_DIALOG,
  Notification: { styles: { root: SURFACE_RAISED } },
};

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
 * Mantine writes numbered shades once for both Color Modes, so the Color Set palettes follow the
 * active `colorMode`. `gray` and `dark` each belong to one Color Mode and are always both present.
 */
export function mantineTheme(
  resolved: ResolvedAppearance,
  colorMode: ResolvedColorMode,
): MantineThemeOverride {
  return createTheme({
    colors: {
      ...resolved[colorMode].palettes,
      gray: resolved.light.neutralPalette,
      dark: resolved.dark.neutralPalette,
    },
    components: {
      ...FLOATING_LAYERS,
      ...(resolved.layout.density === "compact" && COMPACT_CONTROLS),
    },
    defaultRadius: "md",
    focusRing: "auto",
    fontFamily: FONT_FAMILY,
    fontFamilyMonospace: FONT_FAMILY,
    primaryColor: ACCENT_PALETTE,
    primaryShade: FILL_SHADE,
    respectReducedMotion: true,
    scale: resolved.layout.scale,
    variantColorResolver,
  });
}
