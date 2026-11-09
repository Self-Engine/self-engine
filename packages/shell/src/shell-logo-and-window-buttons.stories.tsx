import type { Meta } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Shell, type ShellProps } from "./index.ts";
import {
  BOTH_COLLAPSED,
  LOGO,
  LOGO_AND_WINDOW_BUTTONS,
  SCALING_LOGO,
  STRIP_HEIGHT,
  appRegionOf,
  atSmallestFontScale,
  atViewport,
  brandPlace,
  burgerOf,
  canvasRoot,
  centerX,
  centerY,
  collapseToggle,
  dividerOf,
  expandToggle,
  expectContainersReachTheTop,
  expectEntriesBelowTheStrip,
  expectEntriesCenteredOnTheIconsOnlyNavbar,
  expectIconsOnlyNavbarHoldsTheWindowButtons,
  expectMarkOnTheIconAxis,
  expectNameFitsTheNavbar,
  expectReportedOnce,
  expectStripOverAnIconsOnlyNavbar,
  headerOf,
  markPlace,
  markStaysPutWhenToggling,
  navbarHandle,
  navbarOf,
  paneOf,
  pressHandle,
  resizable,
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

export const StripForTheWindowButtons: Story = {
  ...atViewport("wide"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const first = canvas.getByRole("link", { name: "Projects" });
    await expect(first.getBoundingClientRect().top).toBeCloseTo(
      navbarOf(canvas).getBoundingClientRect().top + 48,
      0,
    );
    await expect(appRegionOf(navbarOf(canvas).firstElementChild!)).toBe("drag");
  },
};

/** The medium step forces the icons, and the Module Sidebar is open beside them. */
export const StripOverTheIconsOnlyNavbarAtTheMediumStep: Story = {
  ...atViewport("medium"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expectStripOverAnIconsOnlyNavbar(canvas);
  },
};

export const StripOverANavbarTheUserCollapsed: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 }, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expectStripOverAnIconsOnlyNavbar(canvas);
    await expect(navbarHandle(canvas).getBoundingClientRect().top).toBeCloseTo(
      navbarOf(canvas).getBoundingClientRect().top + STRIP_HEIGHT,
      0,
    );
  },
};

export const WindowButtonsAndPageTitleShareALine: Story = {
  ...atViewport("wide"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const strip = navbarOf(canvas).firstElementChild!;
    const title = canvas.getByRole("heading", { name: "Time" });
    await expect(centerY(strip)).toBeCloseTo(centerY(title), 0);
  },
};

/** Plain CSS: it moves the window in Electron and means nothing in a browser. */
export const TheTopEdgeDragsTheWindowAndItsControlsStayClickable: Story = {
  ...atViewport("narrow"),
  args: {
    channelBadge: <span>Nightly</span>,
    headerEnd: <button type="button">Search</button>,
    reserveWindowButtons: true,
  },
  play: async ({ canvas }) => {
    const title = canvas.getByRole("heading", { name: "Time" });
    const header = title.parentElement!.parentElement!;
    await expect(appRegionOf(header)).toBe("drag");
    await expect(appRegionOf(canvas.getByRole("button", { name: "Open navigation" }))).toBe(
      "no-drag",
    );
    await expect(appRegionOf(canvas.getByRole("button", { name: "Search" }).parentElement!)).toBe(
      "no-drag",
    );
    await expect(appRegionOf(canvas.getByText("Nightly").parentElement!)).toBe("no-drag");
    const topEdge = [...canvasRoot(canvas).querySelectorAll("*")].find(
      (element) =>
        appRegionOf(element) === "drag" && getComputedStyle(element).position === "fixed",
    );
    await expect(topEdge?.getBoundingClientRect()).toMatchObject({ top: 0, left: 0, width: 800 });
  },
};

export const TheNavbarHandleStaysGrabbableInTheDragRegion: Story = {
  ...atViewport("wide"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(appRegionOf(navbarHandle(canvas))).toBe("no-drag");
  },
};

export const NoStripWithoutWindowButtonsOrLogo: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const first = canvas.getByRole("link", { name: "Projects" });
    await expect(first.getBoundingClientRect().top).toBeLessThan(40);
  },
};

export const LogoDoesNotMoveWithTheNavbar: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const place = brandPlace(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.release(40);
    await expect(widthOf(navbar)).toBe(260);
    await expect(brandPlace(canvas)).toEqual(place);
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(widthOf(navbar)).toBe(56));
    await expect(brandPlace(canvas)).toEqual(place);
  },
};

/** The macOS buttons end 76 px from the window edge: 16 px inset and 60 px wide. */
export const LogoSitsRightOfTheWindowButtons: Story = {
  ...atViewport("wide"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const mark = canvas.getByTestId("mark");
    await expect(mark.getBoundingClientRect().left).toBeGreaterThanOrEqual(76 + 8);
    await expect(centerY(mark)).toBeCloseTo(
      centerY(canvas.getByRole("heading", { name: "Time" })),
      0,
    );
  },
};

/** Where the entries center their icons: 8 of frame, 10 of padding, 4 to center 28 px in 36. */
export const TheMarkSitsOnTheIconAxisBesideItsNameWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const mark = canvas.getByTestId("mark");
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    await expect(mark.getBoundingClientRect().left).toBeCloseTo(22, 0);
    await expect(centerX(mark)).toBeCloseTo(
      centerX(canvas.getByRole("link", { name: "Projects" }).querySelector("svg")!),
      0,
    );
  },
};

/** Only the name goes: the mark does not jump when it has the place to itself. */
export const TheMarkDoesNotMoveWhenItsNameGoesWithoutWindowButtons: Story = {
  ...atViewport("medium"),
  ...resizable,
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    const place = canvas.getByTestId("mark").getBoundingClientRect().left;
    await userEvent.click(collapseToggle(canvas));
    await waitFor(() => expect(canvas.queryByText("Self-Engine")).toBeNull());
    await expect(canvas.getByTestId("mark").getBoundingClientRect().left).toBe(place);
  },
};

export const LogoKeepsItsNameOverAnIconsOnlyNavbar: Story = {
  ...atViewport("medium"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
  },
};

export const TheStripReadsAsOneSurface: Story = {
  ...atViewport("wide"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const box = navbar.getBoundingClientRect();
    const divider = dividerOf(canvas).getBoundingClientRect();
    await expect(getComputedStyle(navbar).borderInlineEndWidth).toBe("0px");
    await expect(divider.top).toBeCloseTo(box.top + STRIP_HEIGHT, 0);
    await expect(divider.bottom).toBeCloseTo(box.bottom, 0);
    await expect(divider.right).toBeCloseTo(box.right, 0);
    await expect(dividerOf(canvas)).toHaveStyle({
      backgroundColor: getComputedStyle(navbar).getPropertyValue("--se-border"),
    });
    await expect(navbarHandle(canvas).getBoundingClientRect().top).toBeCloseTo(
      box.top + STRIP_HEIGHT,
      0,
    );
  },
};

export const TheStripStaysForTheLogoWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const firstEntry = canvas.getByRole("link", { name: "Projects" });
    await expect(firstEntry.getBoundingClientRect().top).toBeCloseTo(
      navbarOf(canvas).getBoundingClientRect().top + STRIP_HEIGHT,
      0,
    );
  },
};

/** Mantine's Drawer sits at 200 and the Navbar is the one it has to clear. */
export const TheLogoDragsTheWindowAndTakesNoPointer: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const logo = getComputedStyle(canvas.getByTestId("mark").parentElement!);
    await expect(logo.getPropertyValue("-webkit-app-region")).toBe("drag");
    await expect(logo.pointerEvents).toBe("none");
    await expect(Number(logo.zIndex)).toBeGreaterThan(
      Number(getComputedStyle(navbarOf(canvas)).zIndex),
    );
    await expect(Number(logo.zIndex)).toBeLessThan(200);
  },
};

export const NoLogoInTheFrameAtTheNarrowStep: Story = {
  ...atViewport("narrow"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    await expect(canvas.queryByTestId("mark")).toBeNull();
    await expect(canvas.queryByText("Self-Engine")).toBeNull();
  },
};

export const NoLogoAtPhoneWidth: Story = {
  ...atViewport("phone"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    await expect(canvas.queryByTestId("mark")).toBeNull();
    await expect(canvas.queryByText("Self-Engine")).toBeNull();
  },
};

/** 56 px at the standard scale while the Module Sidebar is open: the buttons sit in its strip. */
export const TheIconsOnlyNavbarFollowsTheFontScaleWithWindowButtons: Story = {
  ...atSmallestFontScale("medium"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(navbar.getBoundingClientRect().width).toBeCloseTo(49, 0);
    const icon = canvas.getByRole("link", { name: "Projects" }).querySelector("svg")!;
    await expect(centerX(icon)).toBeCloseTo(centerX(navbar), 0);
  },
};

export const ACollapsedNavbarFollowsTheFontScaleWithWindowButtons: Story = {
  ...atSmallestFontScale("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 }, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(49, 0);
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
    await expect(burger.getBoundingClientRect().left).toBeCloseTo(84, 0);
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

/** The native buttons do not follow the font scale, so neither does the room for them. */
export const TheNarrowHeaderClearsTheWindowButtonsAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("narrow"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(burgerOf(canvas).getBoundingClientRect().left).toBeCloseTo(84, 0);
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
    ).toBeCloseTo(8 + 16, 0);
  },
};

export const TheNarrowHeaderKeepsItsPaddingWithoutWindowButtons: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await expect(burgerOf(canvas).getBoundingClientRect().left).toBeCloseTo(8 + 16, 0);
  },
};

export const TheHeaderKeepsItsPaddingBesideTheNavbarWithWindowButtons: Story = {
  ...atViewport("medium"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(collapseToggle(canvas).getBoundingClientRect().left).toBeCloseTo(
      paneOf(canvas, "Page content").getBoundingClientRect().left + 16,
      0,
    );
  },
};

export const TheIconsOnlyNavbarHoldsTheWindowButtonsWhenBothAreCollapsed: Story = {
  ...atViewport("wide"),
  args: BOTH_COLLAPSED,
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(76);
    await expectIconsOnlyNavbarHoldsTheWindowButtons(canvas);
    await expectContainersReachTheTop(canvas);
    await expectEntriesBelowTheStrip(canvas);
    await expectEntriesCenteredOnTheIconsOnlyNavbar(canvas);
    const active = canvas.getByRole("link", { name: "Time", current: "page" });
    await expect(widthOf(active)).toBe(36);
    await expect(Math.round(active.getBoundingClientRect().height)).toBe(40);
    await expect([...navbar.children].filter((child) => widthOf(child) === 1)).toEqual([]);
    await expect(navbarHandle(canvas).getBoundingClientRect().top).toBeCloseTo(
      navbar.getBoundingClientRect().top + STRIP_HEIGHT,
      0,
    );
  },
};

/** The buttons float over the middle of the icons-only Navbar, so only its full width leaves room to drag. */
export const TheStripSpansTheIconsOnlyNavbarSoTheWindowStaysDraggable: Story = {
  ...atViewport("wide"),
  args: BOTH_COLLAPSED,
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const strip = navbar.firstElementChild!;
    await expect(appRegionOf(strip)).toBe("drag");
    await expect(strip.getBoundingClientRect().left).toBeCloseTo(
      navbar.getBoundingClientRect().left,
      0,
    );
    await expect(widthOf(strip)).toBe(76);
  },
};

export const TheMediumStepWidensTheIconsOnlyNavbarWhenTheModuleSidebarIsClosed: Story = {
  ...atViewport("medium"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(76);
    await expectIconsOnlyNavbarHoldsTheWindowButtons(canvas);
    await expectContainersReachTheTop(canvas);
    await expectEntriesBelowTheStrip(canvas);
  },
};

/** The buttons stay in real pixels, so the icons-only Navbar is wider in Mantine's numbers at a smaller scale. */
export const TheIconsOnlyNavbarHoldsTheWindowButtonsAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("medium"),
  args: { moduleSidebarCollapsed: true, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    // 84 px / 0.875 - 8, at the scale of 0.875.
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(88 * 0.875, 0);
    await expectIconsOnlyNavbarHoldsTheWindowButtons(canvas);
    await expectEntriesCenteredOnTheIconsOnlyNavbar(canvas);
  },
};

export const TheIconsOnlyNavbarHoldsTheWindowButtonsAt112Percent: Story = {
  ...wideAt112Percent,
  args: BOTH_COLLAPSED,
  play: async ({ canvas }) => {
    // 84 px / 1.125 - 8, rounded up, at the scale of 1.125.
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(67 * 1.125, 0);
    await expectIconsOnlyNavbarHoldsTheWindowButtons(canvas);
    await expectEntriesCenteredOnTheIconsOnlyNavbar(canvas);
  },
};

export const TheIconsOnlyNavbarStaysNarrowWhileTheModuleSidebarIsOpen: Story = {
  ...atViewport("wide"),
  args: { ...BOTH_COLLAPSED, moduleSidebarCollapsed: false },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    await expectContainersReachTheTop(canvas);
  },
};

export const TheIconsOnlyNavbarStaysNarrowWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  args: { ...BOTH_COLLAPSED, reserveWindowButtons: false },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expectContainersReachTheTop(canvas);
  },
};

export const TheContentHeaderStartsWithTheMarkWhenBothAreCollapsed: Story = {
  ...atViewport("wide"),
  args: BOTH_COLLAPSED,
  play: async ({ canvas }) => {
    const mark = canvas.getByTestId("mark");
    const logo = mark.parentElement!;
    const toggle = expandToggle(canvas);
    await expect(canvas.queryByText("Self-Engine")).toBeNull();
    await expect(headerOf(canvas).firstElementChild).toBe(logo);
    await expect(getComputedStyle(logo).position).not.toBe("fixed");
    await expect(mark.getBoundingClientRect().left).toBeCloseTo(
      paneOf(canvas, "Page content").getBoundingClientRect().left + 16,
      0,
    );
    await expect(mark.getBoundingClientRect().right).toBeLessThan(
      toggle.getBoundingClientRect().left,
    );
    await expect(centerY(mark)).toBeCloseTo(
      centerY(canvas.getByRole("heading", { name: "Time" })),
      0,
    );
    await expect(appRegionOf(logo)).toBe("drag");
    await expect(getComputedStyle(logo).pointerEvents).toBe("none");
    await expect(appRegionOf(toggle)).toBe("no-drag");
  },
};

export const TheMarkLeavesTheContentHeaderWhenTheModuleSidebarOpens: Story = {
  ...atViewport("medium"),
  ...resizable,
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expect(headerOf(canvas).firstElementChild).toBe(canvas.getByTestId("mark").parentElement);
    await userEvent.click(expandToggle(canvas));
    await waitFor(() => expect(canvas.getByText("Self-Engine")).toBeVisible());
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expect(canvas.getByTestId("mark").getBoundingClientRect().left).toBeCloseTo(84, 0);
  },
};

export const TheHeaderHasNoMarkWhenTheNavbarIsWide: Story = {
  ...atViewport("wide"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expect(headerOf(canvas).firstElementChild).toBe(expandToggle(canvas));
  },
};

export const TheIconsOnlyWidthAndTheLogoFollowTheNavbarWhileDragging: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarCollapsed: true },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(-120);
    await waitFor(() => expect(canvas.queryByText("Self-Engine")).toBeNull());
    await expect(widthOf(navbar)).toBe(76);
    await expect(headerOf(canvas).firstElementChild).toBe(canvas.getByTestId("mark").parentElement);
    await drag.moveBy(-10);
    await waitFor(() => expect(canvas.getByText("Self-Engine")).toBeVisible());
    await expect(widthOf(navbar)).toBe(215);
    await expect(headerOf(canvas).firstElementChild).toBe(expandToggle(canvas));
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
    await drag.moveBy(-130);
    await drag.release(-130);
    await waitFor(() => expect(canvas.queryByText("Self-Engine")).toBeNull());
    await expect(widthOf(navbar)).toBe(76);
    await expectReportedOnce(args.onNavbarCommit, { collapsed: true, expandedWidth: 220 });
  },
};

/** The midpoint of 76 and 215 is 145.5, where the midpoint of the 56 px icons-only Navbar would be 135.5. */
export const TheMidpointFollowsTheIconsOnlyNavbarThatHoldsTheWindowButtons: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { moduleSidebarCollapsed: true, reserveWindowButtons: true },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.release(-80);
    await expect(widthOf(navbar)).toBe(76);
    await expectReportedOnce(args.onNavbarCommit, { collapsed: true, expandedWidth: 220 });
  },
};

export const TheIconsOnlyNavbarHoldingTheWindowButtonsCanBeDraggedWide: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: BOTH_COLLAPSED,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.release(100);
    await expect(widthOf(navbar)).toBe(215);
    await expect(within(navbar).getByText("Projects")).toBeVisible();
    await expectReportedOnce(args.onNavbarCommit, { collapsed: false, expandedWidth: 215 });
  },
};

/** The stored 168 is below this minimum of 215, so it comes back clamped and stays stored as it was. */
export const ArrowKeysCrossTheGapFromTheIconsOnlyNavbarHoldingTheWindowButtons: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { ...BOTH_COLLAPSED, navbar: { collapsed: true, expandedWidth: 168 } },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    navbarHandle(canvas).focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(widthOf(navbar)).toBe(215));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: false,
      expandedWidth: 168,
    });
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(widthOf(navbar)).toBe(76));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: true,
      expandedWidth: 168,
    });
  },
};

export const TheLogoDoesNotMoveWhenTogglingBesideAWideNavbar: Story = {
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

/** Nothing has to clear the window buttons, so the mark can sit in the Navbar like an entry. */
export const AnIconsOnlyNavbarAloneCarriesTheMarkOnItsIconAxis: Story = {
  ...atViewport("medium"),
  args: { logo: LOGO, moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expectContainersReachTheTop(canvas);
    await expectEntriesBelowTheStrip(canvas);
    await expect(canvas.queryByText("Self-Engine")).toBeNull();
    await expectMarkOnTheIconAxis(canvas);
  },
};

export const ACollapsedNavbarAloneCarriesTheMarkAtTheWideStepToo: Story = {
  ...atViewport("wide"),
  args: {
    logo: LOGO,
    moduleSidebarCollapsed: true,
    navbar: { collapsed: true, expandedWidth: 260 },
  },
  play: async ({ canvas }) => {
    await expectContainersReachTheTop(canvas);
    await expect(canvas.queryByText("Self-Engine")).toBeNull();
    await expectMarkOnTheIconAxis(canvas);
  },
};

export const TheNameStaysWhileTheModuleSidebarIsVisibleOverAnIconsOnlyNavbar: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO, navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    await expectContainersReachTheTop(canvas);
  },
};

export const ACollapsingNavbarLosesTheNameWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO, moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    const place = markPlace(canvas);
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(canvas.queryByText("Self-Engine")).toBeNull());
    await expectMarkOnTheIconAxis(canvas);
    await expect(markPlace(canvas)).toEqual(place);
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(canvas.getByText("Self-Engine")).toBeVisible());
    await expect(markPlace(canvas)).toEqual(place);
  },
};

/** A wide Navbar has room for the window buttons, so it stays wide and keeps the logo. */
export const ACollapsedSidebarBesideAWideNavbarKeepsTheStripInTheNavbar: Story = {
  ...atViewport("wide"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expectContainersReachTheTop(canvas);
    await expectEntriesBelowTheStrip(canvas);
    await expect(appRegionOf(navbar.firstElementChild!)).toBe("drag");
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    await expect(canvas.getByTestId("mark").getBoundingClientRect().left).toBeCloseTo(84, 0);
    await expect(centerY(canvas.getByTestId("mark"))).toBeCloseTo(
      centerY(canvas.getByRole("heading", { name: "Time" })),
      0,
    );
    await expect(navbarHandle(canvas).getBoundingClientRect().top).toBeCloseTo(
      navbar.getBoundingClientRect().top + STRIP_HEIGHT,
      0,
    );
    await expect([...navbar.children].filter((child) => widthOf(child) === 1)).toEqual([]);
  },
};

export const ACollapsedSidebarBesideAWideNavbarWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO, moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expectContainersReachTheTop(canvas);
    await expectEntriesBelowTheStrip(canvas);
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    await expect(centerX(canvas.getByTestId("mark"))).toBeCloseTo(
      centerX(canvas.getByRole("link", { name: "Projects" }).querySelector("svg")!),
      0,
    );
  },
};

/** 76 px to the logo's start from the container edge, 129 for mark and name, 10 of padding. */
export const TheMinimumWideWidthClearsTheWindowButtonsAndTheLogo: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(-40);
    await expect(widthOf(navbar)).toBe(215);
    await drag.release(-40);
    await expect(widthOf(navbar)).toBe(215);
    await expectReportedOnce(args.onNavbarCommit, { collapsed: false, expandedWidth: 215 });
    await expectNameFitsTheNavbar(canvas);
  },
};

export const TheMidpointFollowsTheMinimumWideWidth: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { reserveWindowButtons: true },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(-80);
    await expect(widthOf(navbar)).toBe(215);
    await drag.release(-90);
    await expect(widthOf(navbar)).toBe(56);
    await expectReportedOnce(args.onNavbarCommit, { collapsed: true, expandedWidth: 220 });
  },
};

export const AStoredWidthBelowTheMinimumIsClampedWithWindowButtons: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: false, expandedWidth: 168 }, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(215);
  },
};

/** The logo needs less than today's minimum here, so that minimum stays. */
export const TheMinimumWideWidthStaysAt168WithoutWindowButtons: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO, navbar: { collapsed: false, expandedWidth: 168 } },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(168);
    await expectNameFitsTheNavbar(canvas);
  },
};

/** The buttons are real pixels and the rest follows the scale, so the minimum differs per scale. */
export const TheNameFitsTheMinimumWideWidthAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("wide"),
  args: {
    logo: SCALING_LOGO,
    navbar: { collapsed: false, expandedWidth: 168 },
    reserveWindowButtons: true,
  },
  play: async ({ canvas }) => {
    // 84 px / 0.875 - 8 + 129 + 10, at the scale of 0.875.
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(227 * 0.875, 0);
    await expectNameFitsTheNavbar(canvas);
  },
};

export const TheNameFitsTheMinimumWideWidthAt112Percent: Story = {
  ...wideAt112Percent,
  args: {
    logo: SCALING_LOGO,
    navbar: { collapsed: false, expandedWidth: 168 },
    reserveWindowButtons: true,
  },
  play: async ({ canvas }) => {
    // 84 px / 1.125 - 8 + 129 + 10, rounded up, at the scale of 1.125.
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(206 * 1.125, 0);
    await expectNameFitsTheNavbar(canvas);
  },
};

/** The real mark: the frame, the entries and the mark all grow by the same scale. */
export const TheMarkStaysOnTheIconAxisAt112Percent: Story = {
  ...wideAt112Percent,
  args: {
    logo: SCALING_LOGO,
    moduleSidebarCollapsed: true,
    navbar: { collapsed: true, expandedWidth: 260 },
  },
  play: async ({ canvas }) => {
    await expectMarkOnTheIconAxis(canvas);
  },
};
