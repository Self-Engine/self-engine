import type { Meta } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Shell, type ShellProps } from "./index.ts";
import {
  atFrameWidth,
  atSmallestFontScale,
  atViewport,
  centerX,
  dividerOf,
  expectActiveEntryFillsTheColumn,
  expectReportedOnce,
  navbarHandle,
  navbarOf,
  paneOf,
  pressHandle,
  resizable,
  sidebarHandle,
  wideAt112Percent,
  widthOf,
  type Story,
  shellMeta,
} from "./shell-story-helpers.tsx";

const meta = { ...shellMeta, title: "Shell/Navbar", component: Shell } satisfies Meta<ShellProps>;

export default meta;

export const NavbarIsWideAtTheWideStep: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(220);
    for (const icon of navbarOf(canvas).querySelectorAll("a svg")) {
      await expect(widthOf(icon)).toBe(20);
    }
    await expect(
      widthOf(canvas.getByText("Sidebar content").closest(".mantine-Splitter-pane")!),
    ).toBe(240);
  },
};

export const TheActiveEntryOfTheIconsOnlyNavbarIs36By40: Story = {
  ...atViewport("medium"),
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    for (const icon of navbarOf(canvas).querySelectorAll("a svg")) {
      await expect(widthOf(icon)).toBe(24);
    }
    await expectActiveEntryFillsTheColumn(
      canvas.getByRole("link", { name: "Time", current: "page" }),
    );
  },
};

export const TheActiveEntryIs36By40WhenTheUserCollapsedTheNavbarToo: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    for (const icon of navbarOf(canvas).querySelectorAll("a svg")) {
      await expect(widthOf(icon)).toBe(24);
    }
    await expectActiveEntryFillsTheColumn(
      canvas.getByRole("link", { name: "Time", current: "page" }),
    );
  },
};

export const IconsOnlyEntriesShowTheirNameInATooltip: Story = {
  ...atViewport("medium"),
  play: async ({ canvas }) => {
    await userEvent.hover(canvas.getByRole("link", { name: "Projects" }));
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("Projects");
  },
};

export const ActiveEntryIsMarkedInItsModuleColor: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const active = canvas.getByRole("link", { name: "Time", current: "page" });
    const scope = getComputedStyle(active);
    await expect(active).toHaveStyle({
      backgroundColor: scope.getPropertyValue("--se-module-soft"),
    });
    await expect(canvas.getByRole("link", { name: "Projects" })).not.toHaveAttribute(
      "aria-current",
    );
  },
};

export const CollapsedNavbarShowsIconsOnlyEvenWhenWide: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(56);
    await expect(within(navbar).queryByText("Projects")).toBeNull();
  },
};

export const DraggingTheNavbarChangesOnlyTheNavbarAndTheContent: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const sidebar = paneOf(canvas, "Sidebar content");
    const content = paneOf(canvas, "Page content");
    const contentWidth = widthOf(content);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(20);
    await expect(widthOf(navbar)).toBe(240);
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
    await drag.moveBy(40);
    await drag.release(40);
    await expect(widthOf(navbar)).toBe(260);
    await expect(widthOf(sidebar)).toBe(240);
    await expect(widthOf(content)).toBe(contentWidth - 40);
    await expect(args.onNavbarCommit).toHaveBeenCalledTimes(1);
    await expect(args.onNavbarCommit).toHaveBeenCalledWith({
      collapsed: false,
      expandedWidth: 260,
    });
  },
};

export const NavbarDragFollowsThePointerAt112Percent: Story = {
  ...wideAt112Percent,
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const start = navbar.getBoundingClientRect().width;
    await expect(start).toBeCloseTo(247.5, 0);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(1);
    await expect(navbar.getBoundingClientRect().width).toBeCloseTo(start + 1, 1);
    await drag.moveBy(36);
    await expect(navbar.getBoundingClientRect().width).toBeCloseTo(start + 36, 1);
    await drag.release(36);
    await expect(navbar.getBoundingClientRect().width).toBeCloseTo(start + 36, 0);
    await expect(args.onNavbarCommit).toHaveBeenCalledWith({
      collapsed: false,
      expandedWidth: 252,
    });
  },
};

/** A press that changes nothing is no change to store, on either handle. */
export const AReleaseWithoutAChangeReportsNothing: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const sidebar = paneOf(canvas, "Sidebar content");
    const atRest = await pressHandle(navbarHandle(canvas));
    await atRest.release(0);
    const andBack = await pressHandle(navbarHandle(canvas));
    await andBack.moveBy(40);
    await andBack.release(0);
    await expect(widthOf(navbar)).toBe(220);
    const sidebarAtRest = await pressHandle(sidebarHandle(canvas));
    await sidebarAtRest.release(0);
    const sidebarAndBack = await pressHandle(sidebarHandle(canvas));
    await sidebarAndBack.moveBy(40);
    await sidebarAndBack.release(0);
    await expect(widthOf(sidebar)).toBe(240);
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
    await expect(args.onModuleSidebarWidthCommit).not.toHaveBeenCalled();
  },
};

export const NavbarSettlesOnTheMinimumWideWidth: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(-107);
    await expect(widthOf(navbar)).toBe(168);
    await drag.release(-107);
    await expect(widthOf(navbar)).toBe(168);
    await expect(within(navbar).getByText("Projects")).toBeVisible();
    await expectReportedOnce(args.onNavbarCommit, {
      collapsed: false,
      expandedWidth: 168,
    });
  },
};

/** No width between the two forms ever shows, so no label is ever cut off. */
export const NavbarSwitchesFormWhileDragging: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(-109);
    await expect(widthOf(navbar)).toBe(56);
    await waitFor(() => expect(within(navbar).queryByText("Projects")).toBeNull());
    await drag.moveBy(-60);
    await expect(widthOf(navbar)).toBe(168);
    await waitFor(() => expect(within(navbar).getByText("Projects")).toBeVisible());
    await drag.moveBy(-30);
    await expect(widthOf(navbar)).toBe(190);
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
    await drag.moveBy(-120);
    await drag.release(-120);
    await expect(widthOf(navbar)).toBe(56);
    await expectReportedOnce(args.onNavbarCommit, { collapsed: true, expandedWidth: 220 });
  },
};

export const EscapeBringsTheNavbarBackAfterItSwitched: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(-120);
    await waitFor(() => expect(within(navbar).queryByText("Projects")).toBeNull());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(widthOf(navbar)).toBe(220));
    await waitFor(() => expect(within(navbar).getByText("Projects")).toBeVisible());
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
  },
};

export const NavbarSettlesOnIconsOnlyBelowTheMidpoint: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { navbar: { collapsed: false, expandedWidth: 250 } },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.release(-139);
    await expect(widthOf(navbar)).toBe(56);
    await expect(within(navbar).queryByText("Projects")).toBeNull();
    await expectReportedOnce(args.onNavbarCommit, {
      collapsed: true,
      expandedWidth: 250,
    });
  },
};

export const CollapsedNavbarCanBeDraggedWide: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.release(144);
    await expect(widthOf(navbar)).toBe(200);
    await expect(within(navbar).getByText("Projects")).toBeVisible();
    await expectReportedOnce(args.onNavbarCommit, {
      collapsed: false,
      expandedWidth: 200,
    });
  },
};

/** A drag says where it wants the Navbar, so unlike a key press it does not bring the stored width back. */
export const ACollapsedNavbarDraggedIntoTheGapSettlesOnTheMinimum: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.release(64);
    await expect(widthOf(navbar)).toBe(168);
    await expectReportedOnce(args.onNavbarCommit, {
      collapsed: false,
      expandedWidth: 168,
    });
  },
};

export const NavbarDoubleClickTogglesAndRestoresTheWidth: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { navbar: { collapsed: false, expandedWidth: 260 } },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(widthOf(navbar)).toBe(56));
    await expectReportedOnce(args.onNavbarCommit, {
      collapsed: true,
      expandedWidth: 260,
    });
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(widthOf(navbar)).toBe(260));
    await expect(args.onNavbarCommit).toHaveBeenCalledTimes(2);
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: false,
      expandedWidth: 260,
    });
  },
};

export const NavbarMovesWithTheArrowKeys: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    navbarHandle(canvas).focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(widthOf(navbar)).toBe(230));
    await expectReportedOnce(args.onNavbarCommit, {
      collapsed: false,
      expandedWidth: 230,
    });
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(widthOf(navbar)).toBe(220));
    await expect(args.onNavbarCommit).toHaveBeenCalledTimes(2);
  },
};

/** The settling rule would otherwise pull every key press back and trap the keyboard user. */
export const ArrowKeysCrossTheGapBetweenIconsOnlyAndWide: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { navbar: { collapsed: false, expandedWidth: 260 } },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    navbarHandle(canvas).focus();
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(widthOf(navbar)).toBe(56));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: true,
      expandedWidth: 260,
    });
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(widthOf(navbar)).toBe(260));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: false,
      expandedWidth: 260,
    });
  },
};

/** Only from the minimum does one step left reach the gap. */
export const ArrowLeftCrossesTheGapFromTheMinimumWideWidth: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { navbar: { collapsed: false, expandedWidth: 168 } },
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    navbarHandle(canvas).focus();
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(widthOf(navbar)).toBe(56));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: true,
      expandedWidth: 168,
    });
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(widthOf(navbar)).toBe(168));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: false,
      expandedWidth: 168,
    });
  },
};

export const EscapeCancelsANavbarDrag: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.moveBy(40);
    await expect(widthOf(navbar)).toBe(260);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(widthOf(navbar)).toBe(220));
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
  },
};

export const EntriesKeepTheirHeightAndIconAxisWhenTheLabelGoes: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const entry = () => within(navbar).getByRole("link", { name: "Projects" });
    const geometry = () => {
      const icon = entry().querySelector("svg")!.getBoundingClientRect();
      return {
        height: entry().getBoundingClientRect().height,
        iconCenter: icon.left + icon.width / 2,
      };
    };
    const labelled = geometry();
    await userEvent.dblClick(navbarHandle(canvas));
    await waitFor(() => expect(widthOf(navbar)).toBe(56));
    await expect(geometry()).toEqual(labelled);
    const icon = entry().querySelector("svg")!.getBoundingClientRect();
    const box = navbar.getBoundingClientRect();
    await expect(icon.left + icon.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
  },
};

export const TheDividerRunsTheFullHeightWithoutAStrip: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    await expect(dividerOf(canvas).getBoundingClientRect().top).toBeCloseTo(
      navbarOf(canvas).getBoundingClientRect().top,
      0,
    );
  },
};

export const IconsOnlyEntriesFitAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("medium"),
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const entry = canvas.getByRole("link", { name: "Projects" });
    const entryBox = entry.getBoundingClientRect();
    const icon = entry.querySelector("svg")!.getBoundingClientRect();
    await expect(icon.left).toBeGreaterThanOrEqual(entryBox.left);
    await expect(icon.right).toBeLessThanOrEqual(entryBox.right);
    await expect(entryBox.right).toBeLessThanOrEqual(navbar.getBoundingClientRect().right);
    await expect(icon.left + icon.width / 2).toBeCloseTo(centerX(navbar), 0);
  },
};

export const NavbarHasAHandleOnlyAtTheWideStep: Story = {
  ...atViewport("medium"),
  ...resizable,
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("separator", { name: "Resize navbar" })).toBeNull();
  },
};

export const NavbarWidthComesBackAfterTheWindowWasNarrow: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const drag = await pressHandle(navbarHandle(canvas));
    await drag.release(40);
    await expect(widthOf(navbar)).toBe(260);
    await expect(args.onNavbarCommit).toHaveBeenCalledTimes(1);
    await atFrameWidth(1100, async () => {
      await waitFor(() => expect(widthOf(navbar)).toBe(56));
    });
    await waitFor(() => expect(widthOf(navbarOf(canvas))).toBe(260));
    await expect(args.onNavbarCommit).toHaveBeenCalledTimes(1);
  },
};
