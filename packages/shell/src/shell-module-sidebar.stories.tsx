import { MantineThemeProvider } from "@mantine/core";
import type { Meta } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { defineContribution, Shell, type ShellProps } from "./index.ts";
import {
  ENTRIES,
  LOGO,
  LOGO_AND_WINDOW_BUTTONS,
  STRIP_HEIGHT,
  appRegionOf,
  atFrameWidth,
  atViewport,
  burgerOf,
  centerY,
  collapseToggle,
  expandToggle,
  expectReportedOnce,
  navbarOf,
  paneOf,
  pressHandle,
  queryCollapseToggle,
  resizable,
  sidebarHandle,
  wideAt112Percent,
  widthOf,
  type Story,
  shellMeta,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Module Sidebar",
  component: Shell,
} satisfies Meta<ShellProps>;

export default meta;

/** `Splitter` knows nothing of Mantine's scale, so the Shell has to apply it. */
export const ModuleSidebarGrowsWithTheScale: Story = {
  ...atViewport("wide"),
  decorators: [
    (Story) => (
      <MantineThemeProvider theme={{ scale: 1.125 }}>
        <Story />
      </MantineThemeProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(
      widthOf(canvas.getByText("Sidebar content").closest(".mantine-Splitter-pane")!),
    ).toBe(270);
  },
};

export const TheModuleSidebarGetsADragStripAboveIt: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const pane = paneOf(canvas, "Sidebar content");
    const strip = pane.firstElementChild!;
    await expect(appRegionOf(strip)).toBe("drag");
    await expect(strip.getBoundingClientRect()).toMatchObject({
      top: pane.getBoundingClientRect().top,
      height: STRIP_HEIGHT,
      width: pane.getBoundingClientRect().width,
    });
    await expect(canvas.getByText("Sidebar content").getBoundingClientRect().top).toBeGreaterThan(
      pane.getBoundingClientRect().top + STRIP_HEIGHT,
    );
  },
};

export const DraggingTheModuleSidebarChangesOnlyItAndTheContent: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    const sidebar = paneOf(canvas, "Sidebar content");
    const content = paneOf(canvas, "Page content");
    const contentWidth = widthOf(content);
    const drag = await pressHandle(sidebarHandle(canvas));
    await drag.moveBy(20);
    await expect(widthOf(sidebar)).toBe(260);
    await expect(args.onModuleSidebarWidthCommit).not.toHaveBeenCalled();
    await drag.release(50);
    await expect(widthOf(sidebar)).toBe(290);
    await expect(widthOf(navbar)).toBe(220);
    await expect(widthOf(content)).toBe(contentWidth - 50);
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 290);
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
  },
};

export const ModuleSidebarDragStopsAtItsLimits: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const sidebar = paneOf(canvas, "Sidebar content");
    const drag = await pressHandle(sidebarHandle(canvas));
    await drag.release(-200);
    await expect(widthOf(sidebar)).toBe(200);
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 200);
    const second = await pressHandle(sidebarHandle(canvas));
    await second.release(400);
    await expect(widthOf(sidebar)).toBe(360);
    await expect(args.onModuleSidebarWidthCommit).toHaveBeenLastCalledWith(360);
  },
};

export const ModuleSidebarDragFollowsThePointerAt112Percent: Story = {
  ...wideAt112Percent,
  ...resizable,
  play: async ({ args, canvas }) => {
    const sidebar = paneOf(canvas, "Sidebar content");
    await expect(sidebar.getBoundingClientRect().width).toBeCloseTo(270, 0);
    const drag = await pressHandle(sidebarHandle(canvas));
    await drag.moveBy(1);
    await expect(sidebar.getBoundingClientRect().width).toBeCloseTo(271, 1);
    await drag.release(45);
    await expect(sidebar.getBoundingClientRect().width).toBeCloseTo(315, 0);
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 280);
  },
};

export const ModuleSidebarStaysResizableAtTheMediumStep: Story = {
  ...atViewport("medium"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const sidebar = paneOf(canvas, "Sidebar content");
    const drag = await pressHandle(sidebarHandle(canvas));
    await drag.release(30);
    await expect(widthOf(sidebar)).toBe(270);
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 270);
  },
};

/** The steps are Mantine's numbers, like the widths, so they grow with the scale too. */
export const ModuleSidebarKeyStepsFollowTheScale: Story = {
  ...wideAt112Percent,
  ...resizable,
  play: async ({ args, canvas }) => {
    const sidebar = paneOf(canvas, "Sidebar content");
    sidebarHandle(canvas).focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(sidebar.getBoundingClientRect().width).toBeCloseTo(281.25, 0));
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 250);
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await waitFor(() => expect(sidebar.getBoundingClientRect().width).toBeCloseTo(337.5, 0));
    await expect(args.onModuleSidebarWidthCommit).toHaveBeenLastCalledWith(300);
  },
};

export const ModuleSidebarMovesWithTheArrowKeys: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ args, canvas }) => {
    const sidebar = paneOf(canvas, "Sidebar content");
    sidebarHandle(canvas).focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(widthOf(sidebar)).toBe(250));
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 250);
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(widthOf(sidebar)).toBe(240));
    await expect(args.onModuleSidebarWidthCommit).toHaveBeenCalledTimes(2);
  },
};

export const ModuleSidebarDoubleClickRestoresTheStandardWidth: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { moduleSidebarWidth: 320 },
  play: async ({ args, canvas }) => {
    const sidebar = paneOf(canvas, "Sidebar content");
    await userEvent.dblClick(sidebarHandle(canvas));
    await waitFor(() => expect(widthOf(sidebar)).toBe(240));
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 240);
  },
};

/** A real pointer in the middle of the gap hits Mantine's thumb, not the handle around it. */
export const ModuleSidebarDoubleClickWorksOnTheMiddleOfTheGap: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { moduleSidebarWidth: 320 },
  play: async ({ args, canvas }) => {
    const sidebar = paneOf(canvas, "Sidebar content");
    const handle = sidebarHandle(canvas);
    const { left, top, width, height } = handle.getBoundingClientRect();
    const hit = document.elementFromPoint(left + width / 2, top + height / 2)!;
    await expect(handle.contains(hit)).toBe(true);
    await expect(hit).not.toBe(handle);
    await userEvent.dblClick(hit);
    await waitFor(() => expect(widthOf(sidebar)).toBe(240));
    await expectReportedOnce(args.onModuleSidebarWidthCommit, 240);
  },
};

/** Mantine's ring follows the focus, and a later key press would light it on a clicked handle. */
export const OnlyTheKeyboardFocusesTheModuleSidebarHandle: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ canvas }) => {
    const handle = sidebarHandle(canvas);
    await userEvent.click(handle);
    await expect(handle).not.toHaveFocus();
    await expect(handle).toHaveAttribute("tabindex", "0");
  },
};

export const ModuleSidebarHandleIsHiddenInTheDrawerSteps: Story = {
  ...atViewport("narrow"),
  ...resizable,
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("separator")).toBeNull();
  },
};

export const TheCollapseToggleExistsOnlyAtTheWideAndMediumSteps: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ canvas }) => {
    await expect(collapseToggle(canvas)).toBeVisible();
    await atFrameWidth(1100, async () => {
      await waitFor(() => expect(widthOf(navbarOf(canvas))).toBe(56));
      await expect(collapseToggle(canvas)).toBeVisible();
    });
    await atFrameWidth(800, async () => {
      await waitFor(() => expect(burgerOf(canvas)).toBeVisible());
      await expect(queryCollapseToggle(canvas)).toBeNull();
    });
    await atFrameWidth(390, async () => {
      await waitFor(() => expect(screen.getByRole("contentinfo")).toBeVisible());
      await expect(queryCollapseToggle(canvas)).toBeNull();
    });
  },
};

/** The place the Burger has at the narrow step: first in the header, level with the title. */
export const TheCollapseToggleStartsTheContentHeader: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const toggle = collapseToggle(canvas);
    const title = canvas.getByRole("heading", { name: "Time" });
    await expect(toggle.getBoundingClientRect().left).toBeCloseTo(
      paneOf(canvas, "Page content").getBoundingClientRect().left + 16,
      0,
    );
    await expect(title.getBoundingClientRect().left).toBeGreaterThan(
      toggle.getBoundingClientRect().right,
    );
    await expect(centerY(toggle)).toBeCloseTo(centerY(title), 0);
    await expect(appRegionOf(toggle)).toBe("no-drag");
  },
};

export const CollapsingHidesTheModuleSidebarAndExpandingBringsItsWidthBack: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { moduleSidebarWidth: 300 },
  play: async ({ args, canvas }) => {
    const content = paneOf(canvas, "Page content");
    const contentWidth = widthOf(content);
    await userEvent.click(collapseToggle(canvas));
    await waitFor(() => expect(canvas.queryByText("Sidebar content")).toBeNull());
    await expect(canvas.queryByRole("separator", { name: "Resize module sidebar" })).toBeNull();
    await expect(widthOf(content)).toBeGreaterThan(contentWidth);
    await expectReportedOnce(args.onModuleSidebarCollapsedCommit, true);
    await userEvent.click(expandToggle(canvas));
    await waitFor(() => expect(widthOf(paneOf(canvas, "Sidebar content"))).toBe(300));
    await expect(sidebarHandle(canvas)).toBeVisible();
    await expect(args.onModuleSidebarCollapsedCommit).toHaveBeenCalledTimes(2);
    await expect(args.onModuleSidebarCollapsedCommit).toHaveBeenLastCalledWith(false);
    await expect(widthOf(content)).toBe(contentWidth);
    await expect(args.onModuleSidebarWidthCommit).not.toHaveBeenCalled();
    await expect(args.onNavbarCommit).not.toHaveBeenCalled();
  },
};

export const ACollapsedSidebarStaysSoAtBothSteps: Story = {
  ...atViewport("medium"),
  args: { moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("Sidebar content")).toBeNull();
    await expect(expandToggle(canvas)).toBeVisible();
    await expect(navbarOf(canvas)).toBeVisible();
  },
};

export const ThePageStaysMountedWhenTheModuleSidebarCollapses: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { ...LOGO_AND_WINDOW_BUTTONS, children: <input aria-label="Draft" /> },
  play: async ({ canvas }) => {
    const draft = canvas.getByRole("textbox", { name: "Draft" });
    await userEvent.type(draft, "unsaved");
    await userEvent.click(collapseToggle(canvas));
    await waitFor(() => expect(canvas.queryByText("Sidebar content")).toBeNull());
    await expect(canvas.getByRole("textbox", { name: "Draft" })).toBe(draft);
    await userEvent.click(expandToggle(canvas));
    await waitFor(() => expect(canvas.getByText("Sidebar content")).toBeVisible());
    await expect(canvas.getByRole("textbox", { name: "Draft" })).toBe(draft);
    await expect(draft).toHaveValue("unsaved");
  },
};

export const TheCollapseToggleLabelIsTranslated: Story = {
  ...atViewport("wide"),
  ...resizable,
  globals: { ...atViewport("wide").globals, language: "de" },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Modul-Sidebar einklappen" }));
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Modul-Sidebar ausklappen" })).toBeVisible(),
    );
  },
};

const unloadedCommand = {
  id: "create",
  kind: "page",
  label: { id: "story-Create entry", message: "Create entry" },
  load: () => {
    throw new Error("Command code must only load on click");
  },
} as const;
const unloadedModule = defineContribution({
  ...ENTRIES[0]!,
  commands: [unloadedCommand],
  primaryAction: unloadedCommand,
  groups: () => new Promise(() => {}),
});

export const MainActionDoesNotWaitForModuleCode: Story = {
  ...atViewport("wide"),
  args: { activeModule: unloadedModule },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Create entry" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Sidebar content" })).toBeVisible();
  },
};
