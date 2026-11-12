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
 * Real pixels: the native buttons do not follow Mantine's font scale.
 */
export const START_AFTER_WINDOW_BUTTONS_PX = 84;

/** Height of the Shell's top strip inside its frame, in Mantine's unscaled pixels. */
export const SHELL_TOP_STRIP_HEIGHT = 48;
