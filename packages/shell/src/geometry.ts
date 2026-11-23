/** Reference content widths in CSS pixels, not Layout Step breakpoints (D215). */
export const SHELL_REFERENCE_WIDTHS = {
  wide: 1280,
  medium: 1100,
  narrow: 800,
  /** The desktop window's minimum width; still the narrow Layout Step. */
  narrowest: 576,
} as const;

/**
 * Where content beside the macOS window buttons starts, from the window edge.
 * The buttons end at 76 px (see desktop `titleBarOptions`); leave another 8 px of space.
 * Real pixels: the native buttons do not follow Mantine's font scale.
 */
export const SHELL_START_AFTER_WINDOW_BUTTONS_PX = 84;

/** Height of the Shell's header, which spans the window above the Navbar and the sheet, in Mantine's unscaled pixels. */
export const SHELL_TOP_STRIP_HEIGHT = 48;

/** The window buttons sit in the header, so their strip is as high as it, in unscaled Mantine pixels. */
export const SHELL_WINDOW_BUTTON_STRIP_HEIGHT = SHELL_TOP_STRIP_HEIGHT;

export type LayoutStep = "wide" | "medium" | "narrow" | "phone";
