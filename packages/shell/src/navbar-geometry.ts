import { clamp } from "@mantine/hooks";

/** Starting values from #19, in Mantine's unscaled numbers. */
export const NAVBAR_ICONS_ONLY_WIDTH = 56;
const NAVBAR_STANDARD_WIDTH = 220;
/** Never narrower than this, whatever the logo needs. */
const NAVBAR_SMALLEST_WIDE_WIDTH = 168;
export const NAVBAR_MAX_WIDTH = 280;
/** Mantine's `xs`, which is the Navbar's padding and the gap between the mark and the name. */
const NAVBAR_PADDING = 10;
/** What the icons-only Navbar has inside its padding: the column every entry centers its icon in. */
export const ICON_COLUMN_WIDTH = NAVBAR_ICONS_ONLY_WIDTH - 2 * NAVBAR_PADDING;
const LOGO_MARK_WIDTH = 28;
/** The mark, the gap and "Self-Engine" in its weight, measured at the standard scale. */
const LOGO_WITH_NAME_WIDTH = LOGO_MARK_WIDTH + NAVBAR_PADDING + 91;
/** Centers the mark in the column of the icons-only Navbar, where the entries center their icons. */
const LOGO_MARK_INSET = (ICON_COLUMN_WIDTH - LOGO_MARK_WIDTH) / 2;
/** The gap around and between the Shell's containers. */
export const GAP = 8;
/** From the window edge to the mark on the icon axis, with or without its name. */
export const LOGO_START_ON_ICON_AXIS = GAP + NAVBAR_PADDING + LOGO_MARK_INSET;
/**
 * Where anything beside the macOS window buttons starts, from the window edge: they end at 76 px
 * (see `titleBarOptions`). In real pixels, because the buttons do not follow Mantine's scale.
 */
export const START_AFTER_WINDOW_BUTTONS_PX = 84;

/** What the user set for the Navbar. Only the wide Layout Step shows it. */
export interface ShellNavbarState {
  readonly collapsed: boolean;
  readonly expandedWidth: number;
}

export const SHELL_STANDARD_NAVBAR: ShellNavbarState = {
  collapsed: false,
  expandedWidth: NAVBAR_STANDARD_WIDTH,
};

/** The two forms the Navbar can settle in right now, in Mantine's unscaled numbers. */
export interface NavbarLimits {
  readonly minWideWidth: number;
  readonly iconsOnlyWidth: number;
}

/**
 * Where anything beside the window buttons starts inside the frame, in Mantine's unscaled numbers.
 * The frame follows the scale and the buttons stay in real pixels, so it depends on the scale.
 */
const startAfterWindowButtons = (scale: number) => START_AFTER_WINDOW_BUTTONS_PX / scale - GAP;

/** The narrowest wide Navbar: the logo with its name has to fit its strip. */
function navbarMinWideWidth(scale: number, reserveWindowButtons: boolean): number {
  const logoStart = reserveWindowButtons
    ? startAfterWindowButtons(scale)
    : NAVBAR_PADDING + LOGO_MARK_INSET;
  return Math.max(
    NAVBAR_SMALLEST_WIDE_WIDTH,
    Math.ceil(logoStart + LOGO_WITH_NAME_WIDTH + NAVBAR_PADDING),
  );
}

interface NavbarLimitsInput {
  readonly scale: number;
  readonly reserveWindowButtons: boolean;
  /** Without the Module Sidebar beside it, an icons-only Navbar has to hold the window buttons. */
  readonly standsAlone: boolean;
}

export function navbarLimits({
  scale,
  reserveWindowButtons,
  standsAlone,
}: NavbarLimitsInput): NavbarLimits {
  return {
    minWideWidth: navbarMinWideWidth(scale, reserveWindowButtons),
    iconsOnlyWidth:
      reserveWindowButtons && standsAlone
        ? Math.ceil(startAfterWindowButtons(scale))
        : NAVBAR_ICONS_ONLY_WIDTH,
  };
}

export const collapseMidpointOf = ({ minWideWidth, iconsOnlyWidth }: NavbarLimits) =>
  (iconsOnlyWidth + minWideWidth) / 2;

/** A stored width outside the current limits is clamped when shown, not reset. */
export function shownWidthOf(
  { collapsed, expandedWidth }: ShellNavbarState,
  { minWideWidth, iconsOnlyWidth }: NavbarLimits,
): number {
  return collapsed ? iconsOnlyWidth : clamp(expandedWidth, minWideWidth, NAVBAR_MAX_WIDTH);
}

/**
 * Where the Navbar comes to rest. A drag snaps by position. A key press only has a direction,
 * and snapping by position would pull it back every time, so it crosses the gap in one step and
 * leaves the stored width alone.
 */
export function settledNavbar(
  width: number,
  current: ShellNavbarState,
  dragged: boolean,
  limits: NavbarLimits,
): ShellNavbarState {
  if (width >= limits.minWideWidth) return { collapsed: false, expandedWidth: Math.round(width) };
  if (!dragged) return { ...current, collapsed: width <= shownWidthOf(current, limits) };
  return width < collapseMidpointOf(limits)
    ? { ...current, collapsed: true }
    : { collapsed: false, expandedWidth: limits.minWideWidth };
}
