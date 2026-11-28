import {
  SHELL_REFERENCE_WIDTHS,
  SHELL_START_AFTER_WINDOW_BUTTONS_PX,
  SHELL_TOP_STRIP_HEIGHT,
} from "@self-engine/shell/geometry";
import type { Meta } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { Shell, type ShellProps } from "./index.ts";
import {
  BOTH_COLLAPSED,
  ENTRIES,
  INDICATOR_ARRIVES,
  LOGO,
  LOGO_AND_WINDOW_BUTTONS,
  SCALING_LOGO,
  appRegionOf,
  atSmallestFontScale,
  atViewport,
  markPlace,
  burgerOf,
  centerX,
  centerY,
  collapseToggle,
  countingIndicator,
  expandToggle,
  expectMarkOnTheIconAxis,
  expectReportedOnce,
  indicatorPlaceOf,
  markStaysPutWhenToggling,
  navbarHandle,
  navbarOf,
  pressHandle,
  resizable,
  sheetOf,
  shellHeaderOf,
  wideAt112Percent,
  widthOf,
  type Story,
  shellMeta,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Logo and Window Buttons",
  component: Shell,
} satisfies Meta<ShellProps>;

export default meta;

/** Mantine's `sm`, the gap between the header's parts. */
const HEADER_GAP = 12;

/** One row across the window, and the Navbar and the sheet start below it. */
export const TheHeaderSpansTheWindowAboveTheNavbarAndTheSheet: Story = {
  ...atViewport("wide"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const header = shellHeaderOf(canvas).getBoundingClientRect();
    await expect(header.top).toBe(0);
    await expect(header.left).toBe(0);
    await expect(Math.round(header.width)).toBe(SHELL_REFERENCE_WIDTHS.wide);
    await expect(Math.round(header.height)).toBe(SHELL_TOP_STRIP_HEIGHT);
    await expect(navbarOf(canvas).getBoundingClientRect().top).toBeCloseTo(header.bottom, 0);
    await expect(sheetOf(canvas).getBoundingClientRect().top).toBeCloseTo(header.bottom, 0);
    await expect(
      canvas.getByRole("link", { name: "Projects" }).getBoundingClientRect().top,
    ).toBeCloseTo(header.bottom, 0);
  },
};

export const TheHeaderSpansTheWindowWithoutWindowButtonsOrLogo: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    await expect(Math.round(shellHeaderOf(canvas).getBoundingClientRect().height)).toBe(
      SHELL_TOP_STRIP_HEIGHT,
    );
    await expect(navbarOf(canvas).getBoundingClientRect().top).toBeCloseTo(
      SHELL_TOP_STRIP_HEIGHT,
      0,
    );
  },
};

/** The desktop app centers the macOS buttons 24 px from the top, on the header's middle. */
export const WindowButtonsAndPageTitleShareALine: Story = {
  ...atViewport("wide"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const title = canvas.getByRole("heading", { name: "Time" });
    await expect(centerY(title)).toBeCloseTo(SHELL_TOP_STRIP_HEIGHT / 2, 0);
    await expect(centerY(shellHeaderOf(canvas))).toBeCloseTo(SHELL_TOP_STRIP_HEIGHT / 2, 0);
  },
};

/** Plain CSS: it moves the window in Electron and means nothing in a browser. */
export const TheHeaderDragsTheWindowAndItsControlsStayClickable: Story = {
  ...atViewport("wide"),
  args: {
    ...LOGO_AND_WINDOW_BUTTONS,
    channelBadge: <span>Nightly</span>,
    contributions: [{ ...ENTRIES[0]!, indicator: countingIndicator() }, ...ENTRIES.slice(1)],
  },
  play: async ({ canvas }) => {
    await expect(appRegionOf(shellHeaderOf(canvas))).toBe("drag");
    await expect(appRegionOf(collapseToggle(canvas))).toBe("no-drag");
    const indicator = await canvas.findByText("Counted 0", {}, INDICATOR_ARRIVES);
    await expect(appRegionOf(indicatorPlaceOf(indicator))).toBe("no-drag");
    await expect(appRegionOf(canvas.getByText("Nightly").parentElement!)).toBe("no-drag");
    await expect(appRegionOf(navbarHandle(canvas))).toBe("no-drag");
  },
};

export const TheNarrowHeaderDragsTheWindowAndItsBurgerStaysClickable: Story = {
  ...atViewport("narrow"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(appRegionOf(shellHeaderOf(canvas))).toBe("drag");
    await expect(appRegionOf(burgerOf(canvas))).toBe("no-drag");
  },
};

/** The Navbar starts below the header, so its handle does too. */
export const TheNavbarHandleStartsBelowTheHeader: Story = {
  ...atViewport("wide"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    await expect(navbarHandle(canvas).getBoundingClientRect().top).toBeCloseTo(
      SHELL_TOP_STRIP_HEIGHT,
      0,
    );
  },
};

/** The macOS buttons end 76 px from the window edge: 16 px inset and 60 px wide. */
export const LogoSitsRightOfTheWindowButtons: Story = {
  ...atViewport("wide"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const mark = canvas.getByTestId("mark");
    await expect(mark.getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX,
      0,
    );
    await expect(centerY(mark)).toBeCloseTo(
      centerY(canvas.getByRole("heading", { name: "Time" })),
      0,
    );
  },
};

/** The logo drags the window with the rest of the header and takes no pointer. */
export const TheLogoDragsTheWindowAndTakesNoPointer: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const logo = getComputedStyle(canvas.getByTestId("mark").parentElement!);
    await expect(logo.getPropertyValue("-webkit-app-region")).toBe("drag");
    await expect(logo.pointerEvents).toBe("none");
  },
};

/** The header does not follow the Navbar: what belongs to the page starts after the buttons and the mark. */
export const TheToggleStartsAfterTheMarkBesideAWideNavbar: Story = {
  ...atViewport("wide"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(220);
    await expect(collapseToggle(canvas).getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX + 28 + HEADER_GAP,
      0,
    );
  },
};

export const TheHeaderStaysPutWhileTheNavbarIsDragged: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const place = markPlace(canvas);
    const toggleLeft = collapseToggle(canvas).getBoundingClientRect().left;
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(40);
    await expect(widthOf(navbar)).toBe(260);
    await expect(collapseToggle(canvas).getBoundingClientRect().left).toBeCloseTo(toggleLeft, 0);
    await drag.release(40);
    await expectReportedOnce(args.onNavbarCommit, { collapsed: false, expandedWidth: 260 });
    await expect(markPlace(canvas)).toEqual(place);
    await expect(collapseToggle(canvas).getBoundingClientRect().left).toBeCloseTo(toggleLeft, 0);
  },
};

/** The logo is the mark alone, named for assistive technology. */
export const TheLogoIsTheMarkAlone: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Self-Engine" })).toContainElement(
      canvas.getByTestId("mark"),
    );
    await expect(canvas.queryByText("Self-Engine")).toBeNull();
  },
};

/** Without window buttons, where the entries center their icons: 10 px of padding, 4 to center 28 px in 36. */
export const TheMarkSitsOnTheIconAxisWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const mark = canvas.getByTestId("mark");
    await expect(mark.getBoundingClientRect().left).toBeCloseTo(14, 0);
    await expect(centerX(mark)).toBeCloseTo(
      centerX(canvas.getByRole("link", { name: "Projects" }).querySelector("svg")!),
      0,
    );
  },
};

export const TheMarkStaysOnTheIconAxisOverAnIconsOnlyNavbar: Story = {
  ...atViewport("medium"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expectMarkOnTheIconAxis(canvas);
    await expect(collapseToggle(canvas).getBoundingClientRect().left).toBeCloseTo(
      56 + HEADER_GAP,
      0,
    );
  },
};

export const TheMarkDoesNotMoveWhenTheNavbarCollapses: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const place = markPlace(canvas);
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(widthOf(navbarOf(canvas))).toBe(56));
    await expectMarkOnTheIconAxis(canvas);
    await expect(markPlace(canvas)).toEqual(place);
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(widthOf(navbarOf(canvas))).toBe(220));
    await expect(markPlace(canvas)).toEqual(place);
  },
};

/** The buttons and the mark are wider than an icons-only Navbar, so the page's part starts after both. */
export const TheMarkStaysAfterTheWindowButtonsOverAnIconsOnlyNavbar: Story = {
  ...atViewport("wide"),
  args: BOTH_COLLAPSED,
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expect(canvas.getByTestId("mark").getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX,
      0,
    );
    await expect(expandToggle(canvas).getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX + 28 + HEADER_GAP,
      0,
    );
  },
};

/** The native buttons do not follow the font scale, so neither does the room for them. */
export const TheRoomForTheWindowButtonsIgnoresTheFontScale: Story = {
  ...atSmallestFontScale("medium"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, logo: SCALING_LOGO },
  play: async ({ canvas }) => {
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(49, 0);
    await expect(canvas.getByTestId("mark").getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX,
      0,
    );
    await expect(collapseToggle(canvas).getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX + (28 + HEADER_GAP) * 0.875,
      0,
    );
  },
};

export const TheLogoDoesNotMoveWhenTogglingTheModuleSidebar: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    await markStaysPutWhenToggling(canvas);
  },
};

export const TheLogoDoesNotMoveWhenTogglingWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    await markStaysPutWhenToggling(canvas);
  },
};

/** At the drawer steps the mark starts the header, before the Burger. */
export const TheMarkStartsTheNarrowHeader: Story = {
  ...atViewport("narrow"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const mark = canvas.getByTestId("mark");
    await expect(mark.getBoundingClientRect().left).toBeCloseTo(16, 0);
    await expect(burgerOf(canvas).getBoundingClientRect().left).toBeGreaterThan(
      mark.getBoundingClientRect().right,
    );
  },
};

export const TheMarkStartsTheNarrowHeaderAfterTheWindowButtons: Story = {
  ...atViewport("narrow"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("mark").getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX,
      0,
    );
  },
};

export const TheMarkStartsThePhoneHeader: Story = {
  ...atViewport("phone"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const mark = canvas.getByTestId("mark");
    await expect(mark.getBoundingClientRect().left).toBeCloseTo(16, 0);
    await expect(
      canvas.getByRole("button", { name: "Open module sidebar" }).getBoundingClientRect().left,
    ).toBeGreaterThan(mark.getBoundingClientRect().right);
  },
};

/** One row: the window buttons end 76 px from the window edge, then Burger, title and badge. */
export const TheNarrowHeaderStartsAfterTheWindowButtons: Story = {
  ...atViewport("narrow"),
  args: { channelBadge: <span>Nightly</span>, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const burger = burgerOf(canvas);
    const title = canvas.getByRole("heading", { name: "Time" });
    const badge = canvas.getByText("Nightly");
    await expect(burger.getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX,
      0,
    );
    await expect(title.getBoundingClientRect().left).toBeGreaterThan(
      burger.getBoundingClientRect().right,
    );
    await expect(badge.getBoundingClientRect().left).toBeGreaterThan(
      title.getBoundingClientRect().right,
    );
    await expect(centerY(burger)).toBeCloseTo(centerY(title), 0);
    await expect(centerY(badge)).toBeCloseTo(centerY(title), 0);
  },
};

export const TheNarrowHeaderClearsTheWindowButtonsAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("narrow"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(burgerOf(canvas).getBoundingClientRect().left).toBeCloseTo(
      SHELL_START_AFTER_WINDOW_BUTTONS_PX,
      0,
    );
  },
};

/** Zoom in Electron can shrink the window's CSS width to this step, and the buttons stay. */
export const ThePhoneHeaderStartsAfterTheWindowButtons: Story = {
  ...atViewport("phone"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const burger = canvas.getByRole("button", { name: "Open module sidebar" });
    await expect(burger.getBoundingClientRect().left).toBeGreaterThanOrEqual(76 + 8);
    await expect(appRegionOf(burger)).toBe("no-drag");
  },
};

export const ThePhoneHeaderKeepsItsPaddingWithoutWindowButtons: Story = {
  ...atViewport("phone"),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Open module sidebar" }).getBoundingClientRect().left,
    ).toBeCloseTo(16, 0);
  },
};

export const TheNarrowHeaderKeepsItsPaddingWithoutWindowButtons: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await expect(burgerOf(canvas).getBoundingClientRect().left).toBeCloseTo(16, 0);
  },
};

/** The mark needs no room of its own, so the Navbar's minimum stays 168 with window buttons too. */
export const TheMinimumWideWidthIs168WithWindowButtons: Story = {
  ...atViewport("wide"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, navbar: { collapsed: false, expandedWidth: 100 } },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(168);
  },
};

/** The real mark: the header, the entries and the mark all grow by the same scale. */
export const TheMarkStaysOnTheIconAxisAt112Percent: Story = {
  ...wideAt112Percent,
  args: {
    logo: SCALING_LOGO,
    moduleSidebarCollapsed: true,
    navbar: { collapsed: true, expandedWidth: 260 },
  },
  play: async ({ canvas }) => {
    await expectMarkOnTheIconAxis(canvas);
    await expect(centerX(canvas.getByTestId("mark"))).toBeCloseTo(centerX(navbarOf(canvas)), 0);
  },
};
