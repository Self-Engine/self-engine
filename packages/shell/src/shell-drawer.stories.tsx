import { SHELL_REFERENCE_WIDTHS, START_AFTER_WINDOW_BUTTONS_PX } from "@self-engine/shell/layout";
import type { Meta } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  Shell,
  ShellGroup,
  ShellGroupEntry,
  type ShellContribution,
  type ShellProps,
} from "./index.ts";
import {
  ENTRIES,
  LOGO,
  LOGO_AND_WINDOW_BUTTONS,
  STRIP_HEIGHT,
  appRegionOf,
  LONG_MODULE,
  atFrameWidth,
  atSmallestFontScale,
  atViewport,
  centerX,
  centerY,
  dividerIn,
  drawerHeaderOf,
  drawerNavbarOf,
  drawerOverlay,
  expectActiveEntryFillsTheColumn,
  expectContentFillsTheFrame,
  expectNavigationLinks,
  openDrawer,
  widthOf,
  type Story,
  shellMeta,
} from "./shell-story-helpers.tsx";

const meta = { ...shellMeta, title: "Shell/Drawer", component: Shell } satisfies Meta<ShellProps>;

export default meta;

export const WidenedWindowClosesTheDrawer: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open navigation" }));
    await screen.findByRole("dialog", { name: "Module Sidebar" });
    await atFrameWidth(SHELL_REFERENCE_WIDTHS.medium, async () => {
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Open navigation" })).toBeVisible(),
    );
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};

export const TheDrawerStaysClickableAboveTheDragRegion: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog", { name: "Module Sidebar" });
    await expect(appRegionOf(drawer)).toBe("no-drag");
    await expect(appRegionOf(drawerOverlay())).toBe("no-drag");
  },
};

export const ThePhoneDrawerStaysClickableAboveTheDragRegion: Story = {
  ...atViewport("phone"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas, "Open module sidebar");
    await expect(appRegionOf(drawer)).toBe("no-drag");
    await expect(appRegionOf(drawerOverlay())).toBe("no-drag");
  },
};

/** The native buttons float above the Drawer too, so its title has to start below them. */
export const TheDrawerHeaderSitsBelowTheStripWithWindowButtons: Story = {
  ...atViewport("narrow"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarWidth: 320 },
  play: async ({ canvas }) => {
    const pageTitle = canvas.getByRole("heading", { name: "Time" });
    const drawer = await openDrawer(canvas);
    const mark = within(drawer).getByTestId("mark");
    const strip = mark.parentElement!.parentElement!;
    await expect(appRegionOf(strip)).toBe("drag");
    await expect(getComputedStyle(strip).borderBlockEndWidth).toBe("0px");
    await expect(strip.getBoundingClientRect().height).toBeCloseTo(STRIP_HEIGHT, 0);
    await expect(centerY(strip)).toBeCloseTo(centerY(pageTitle), 0);
    await expect(drawerHeaderOf(drawer).getBoundingClientRect().top).toBeCloseTo(
      strip.getBoundingClientRect().bottom,
      0,
    );
    await waitFor(() =>
      expect(mark.getBoundingClientRect().left).toBeCloseTo(START_AFTER_WINDOW_BUTTONS_PX, 0),
    );
    await expect(
      within(drawer).getByText("Self-Engine").getBoundingClientRect().right,
    ).toBeLessThan(drawer.getBoundingClientRect().right);
  },
};

/** The whole navigation of the frame, side by side under the strip. */
export const TheDrawerShowsTheNavbarBesideTheModuleSidebar: Story = {
  ...atViewport("narrow"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarWidth: 320 },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const navbar = drawerNavbarOf(drawer);
    const strip = within(drawer).getByTestId("mark").parentElement!.parentElement!;
    const box = navbar.getBoundingClientRect();
    await expect(widthOf(drawer)).toBe(56 + 240);
    await expect(widthOf(navbar)).toBe(56);
    await expect(box.top).toBeCloseTo(strip.getBoundingClientRect().bottom, 0);
    await expect(box.bottom).toBeCloseTo(drawer.getBoundingClientRect().bottom, 0);
    const names = within(navbar)
      .getAllByRole("link")
      .map((entry) => entry.getAttribute("aria-label"));
    await expect(names).toEqual(["Projects", "Time", "Third module", "Settings"]);
    const settings = within(navbar).getByRole("link", { name: "Settings" });
    await expect(settings.getBoundingClientRect().bottom).toBeCloseTo(box.bottom - 10, 0);
    const icon = settings.querySelector("svg")!;
    await expect(centerX(icon)).toBeCloseTo(centerX(navbar), 0);
    const header = drawerHeaderOf(drawer).getBoundingClientRect();
    await expect(header.left).toBeCloseTo(box.right, 0);
    await expect(header.right).toBeCloseTo(drawer.getBoundingClientRect().right, 0);
    await expect(within(drawer).getByRole("button", { name: "Close navigation" })).toBeVisible();
    await expect(
      within(drawer).getByRole("link", { name: "Sidebar content" }).getBoundingClientRect().left,
    ).toBe(header.left + 16);
  },
};

export const TheDrawerDividerStartsBelowTheStripAndLooksLikeTheFrame: Story = {
  ...atViewport("narrow"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const navbar = drawerNavbarOf(drawer);
    const box = navbar.getBoundingClientRect();
    const divider = dividerIn(navbar);
    await expect(divider.getBoundingClientRect().top).toBeCloseTo(box.top, 0);
    await expect(divider.getBoundingClientRect().bottom).toBeCloseTo(box.bottom, 0);
    await expect(divider.getBoundingClientRect().right).toBeCloseTo(box.right, 0);
    const role = (name: string) => getComputedStyle(navbar).getPropertyValue(name);
    await expect(divider).toHaveStyle({ backgroundColor: role("--se-border") });
    await expect(drawer).toHaveStyle({ backgroundColor: role("--se-nav-surface") });
  },
};

/** The Module Sidebar beside the Navbar shows the chosen module's views, so the drawer stays. */
export const SelectingAnEntryLeavesTheDrawerOpen: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const navbar = within(drawerNavbarOf(drawer));
    await userEvent.click(navbar.getByRole("link", { name: "Projects" }));
    await expect(navbar.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects/overview",
    );
    await userEvent.click(navbar.getByRole("link", { name: "Settings" }));
    await expect(navbar.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings/overview",
    );
    await expect(screen.getByRole("dialog", { name: "Module Sidebar" })).toBe(drawer);
    await expect(within(drawer).getByText("Sidebar content")).toBeVisible();
  },
};

const MODULE_WITH_GROUPS: ShellContribution = {
  ...ENTRIES[1]!,
  groups: async () => ({
    default: () => (
      <ShellGroup title="Clients">
        <ShellGroupEntry label="Studio" search={{ client: "studio" }} />
      </ShellGroup>
    ),
  }),
};

/** A View or Group entry finishes the job the overlay was opened for, unlike a module entry. */
export const PickingAViewClosesTheDrawer: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    await userEvent.click(within(drawer).getByRole("link", { name: "Sidebar content" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

export const PickingAGroupEntryClosesTheDrawer: Story = {
  ...atViewport("narrow"),
  args: { activeModule: MODULE_WITH_GROUPS },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    await userEvent.click(await within(drawer).findByRole("link", { name: "Studio" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

export const PickingAViewClosesThePhoneDrawer: Story = {
  ...atViewport("phone"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas, "Open module sidebar");
    await userEvent.click(within(drawer).getByRole("link", { name: "Sidebar content" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

export const OpeningAViewInANewTabLeavesTheDrawerOpen: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const user = userEvent.setup();
    await user.keyboard("{Meta>}");
    await user.click(within(drawer).getByRole("link", { name: "Sidebar content" }));
    await user.keyboard("{/Meta}");
    await expect(screen.getByRole("dialog", { name: "Module Sidebar" })).toBe(drawer);
  },
};

export const TheDrawerNavbarNamesItsEntriesAndMarksTheActiveOne: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const navbar = within(drawerNavbarOf(drawer));
    await expectNavigationLinks(navbar);
    const active = navbar.getByRole("link", { name: "Time", current: "page" });
    await expect(active).toHaveStyle({
      backgroundColor: getComputedStyle(active).getPropertyValue("--se-module-soft"),
    });
    await expectActiveEntryFillsTheColumn(active);
    await userEvent.hover(navbar.getByRole("link", { name: "Projects" }));
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("Projects");
  },
};

export const TheDrawerLogoStartsAtTheLeftEdgeWithoutWindowButtons: Story = {
  ...atViewport("narrow"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const mark = within(drawer).getByTestId("mark");
    const firstEntry = within(drawerNavbarOf(drawer)).getByRole("link", { name: "Projects" });
    await expect(mark.getBoundingClientRect().left).toBeCloseTo(
      firstEntry.getBoundingClientRect().left,
      0,
    );
    await expect(appRegionOf(mark.parentElement!.parentElement!)).toBe("drag");
    await expect(drawerNavbarOf(drawer).getBoundingClientRect().top).toBeCloseTo(
      mark.parentElement!.parentElement!.getBoundingClientRect().bottom,
      0,
    );
  },
};

export const TheDrawerLogoFitsAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("narrow"),
  args: LOGO_AND_WINDOW_BUTTONS,
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    await waitFor(() =>
      expect(within(drawer).getByTestId("mark").getBoundingClientRect().left).toBeCloseTo(
        START_AFTER_WINDOW_BUTTONS_PX,
        0,
      ),
    );
    await expect(
      within(drawer).getByText("Self-Engine").getBoundingClientRect().right,
    ).toBeLessThan(drawer.getBoundingClientRect().right);
  },
};

export const TheDrawerHeaderStaysBelowTheStripWhenTheSidebarScrolls: Story = {
  ...atViewport("narrow"),
  args: {
    ...LOGO_AND_WINDOW_BUTTONS,
    activeModule: LONG_MODULE,
  },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const header = drawerHeaderOf(drawer);
    const firstEntry = within(drawerNavbarOf(drawer)).getByRole("link", { name: "Projects" });
    const top = header.getBoundingClientRect().top;
    const entryTop = firstEntry.getBoundingClientRect().top;
    const viewport = within(drawer)
      .getByText("Sidebar content")
      .closest(".mantine-ScrollArea-viewport");
    if (viewport === null) throw new Error("the Module Sidebar is not in a ScrollArea");
    viewport.scrollTop = 400;
    await expect(viewport.scrollTop).toBe(400);
    await expect(header.getBoundingClientRect().top).toBeCloseTo(top, 0);
    await expect(firstEntry.getBoundingClientRect().top).toBeCloseTo(entryTop, 0);
    await expect(within(drawer).getByTestId("mark").getBoundingClientRect().top).toBeGreaterThan(0);
  },
};

export const TheDrawerHasNoStripWithoutWindowButtonsOrLogo: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const top = drawer.getBoundingClientRect().top;
    await expect(drawerHeaderOf(drawer).getBoundingClientRect().top).toBeCloseTo(top, 0);
    await expect(drawerNavbarOf(drawer).getBoundingClientRect().top).toBeCloseTo(top, 0);
  },
};

/** Unchanged at phone width: the bottom bar holds the modules, the drawer only the views. */
export const ThePhoneDrawerHoldsOnlyTheModuleSidebar: Story = {
  ...atViewport("phone"),
  args: { logo: LOGO, moduleSidebarWidth: 320 },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas, "Open module sidebar");
    await expect(within(drawer).queryByRole("navigation", { name: "Modules" })).toBeNull();
    await expect(within(drawer).queryByTestId("mark")).toBeNull();
    await expect(drawerHeaderOf(drawer).getBoundingClientRect().top).toBeCloseTo(
      drawer.getBoundingClientRect().top,
      0,
    );
    await expect(widthOf(drawer)).toBe(320);
    await expect(
      within(drawer).getByRole("button", { name: "Close module sidebar" }),
    ).toBeVisible();
    await expect(drawer).toHaveStyle({
      backgroundColor: getComputedStyle(drawer).getPropertyValue("--mantine-color-body"),
    });
  },
};

/** The native buttons float above this Drawer too. The strip is all it adds: no logo, no Navbar. */
export const ThePhoneDrawerHeaderSitsBelowTheStripWithWindowButtons: Story = {
  ...atViewport("phone"),
  args: { ...LOGO_AND_WINDOW_BUTTONS, moduleSidebarWidth: 320 },
  play: async ({ canvas }) => {
    const pageTitle = canvas.getByRole("heading", { name: "Time" });
    const drawer = await openDrawer(canvas, "Open module sidebar");
    const header = drawerHeaderOf(drawer);
    const frame = drawer.firstElementChild!;
    const strip = frame.firstElementChild!;
    await expect(frame).not.toBe(header);
    await expect(appRegionOf(frame)).toBe("drag");
    await expect(appRegionOf(strip)).toBe("drag");
    await expect(strip.getBoundingClientRect().height).toBeCloseTo(STRIP_HEIGHT, 0);
    await expect(centerY(strip)).toBeCloseTo(centerY(pageTitle), 0);
    await expect(header.getBoundingClientRect().top).toBeCloseTo(
      strip.getBoundingClientRect().bottom,
      0,
    );
    const stripBottom = strip.getBoundingClientRect().bottom;
    await expect(
      within(drawer).getByText("Module Sidebar").getBoundingClientRect().top,
    ).toBeGreaterThanOrEqual(stripBottom);
    const close = within(drawer).getByRole("button", { name: "Close module sidebar" });
    await expect(close.getBoundingClientRect().top).toBeGreaterThanOrEqual(stripBottom);
    await expect(within(drawer).queryByRole("navigation", { name: "Modules" })).toBeNull();
    await expect(within(drawer).queryByTestId("mark")).toBeNull();
    await expect(widthOf(drawer)).toBe(320);
  },
};

/** Scrolled with the page, the title would slide back under the native buttons. */
export const ThePhoneDrawerHeaderStaysBelowTheStripWhenTheSidebarScrolls: Story = {
  ...atViewport("phone"),
  args: {
    activeModule: LONG_MODULE,
    reserveWindowButtons: true,
  },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas, "Open module sidebar");
    const header = drawerHeaderOf(drawer);
    const top = header.getBoundingClientRect().top;
    const viewport = within(drawer)
      .getByText("Sidebar content")
      .closest(".mantine-ScrollArea-viewport");
    if (viewport === null) throw new Error("the Module Sidebar is not in a ScrollArea");
    viewport.scrollTop = 400;
    await expect(viewport.scrollTop).toBe(400);
    await expect(header.getBoundingClientRect().top).toBeCloseTo(top, 0);
    await expect(top).toBeGreaterThan(drawer.getBoundingClientRect().top);
  },
};

/** A focus ring follows the corners of its element, and Mantine's Burger has square ones. */
export const TheBurgerIsAsRoundAsTheOtherControls: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const burger = canvas.getByRole("button", { name: "Open navigation" });
    const drawer = await openDrawer(canvas);
    const close = within(drawer).getByRole("button", { name: "Close navigation" });
    const radius = getComputedStyle(close).borderRadius;
    await expect(radius).not.toBe("0px");
    await expect(getComputedStyle(burger).borderRadius).toBe(radius);
  },
};

/** The drawer steps have their own way to the Module Sidebar, whatever the user set above them. */
export const TheCollapsedStateDoesNotReachTheNarrowDrawer: Story = {
  ...atViewport("narrow"),
  args: { moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expectContentFillsTheFrame(canvas, SHELL_REFERENCE_WIDTHS.narrow);
    await openDrawer(canvas);
  },
};

export const LabelsAreTranslated: Story = {
  globals: { ...atViewport("narrow").globals, language: "de" },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Navigation öffnen" }));
    const drawer = await screen.findByRole("dialog", { name: "Modul-Sidebar" });
    await waitFor(() =>
      expect(within(drawer).getByRole("button", { name: "Navigation schließen" })).toBeVisible(),
    );
    await expect(within(drawer).getByRole("navigation", { name: "Module" })).toBeVisible();
  },
};
