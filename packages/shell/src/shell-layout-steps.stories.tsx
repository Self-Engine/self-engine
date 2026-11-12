import { SHELL_REFERENCE_WIDTHS } from "@self-engine/shell/layout";
import { ProjectsIcon } from "@self-engine/icons";
import type { Meta } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Shell, type ShellProps } from "./index.ts";
import {
  atFrameWidth,
  atViewport,
  canvasRoot,
  expectContentFillsTheFrame,
  expectShownWithoutReport,
  expectWindow,
  expectNavigationLinks,
  inDark,
  navbarOf,
  paneOf,
  widthOf,
  type Story,
  shellMeta,
} from "./shell-story-helpers.tsx";

const meta = {
  ...shellMeta,
  title: "Shell/Layout Steps",
  component: Shell,
} satisfies Meta<ShellProps>;

export default meta;

export const Wide: Story = {
  ...atViewport("wide"),
  play: async ({ canvas, globals }) => {
    await expectWindow(canvas, "wide", globals);
    await expect(canvasRoot(canvas)).toHaveAttribute("data-layout-step", "wide");
    await expectNavigationLinks(within(navbarOf(canvas)));
    const navbar = within(canvas.getByRole("navigation", { name: "Modules" }));
    await expect(navbar.getByText("Projects")).toBeVisible();
    await expect(navbar.getByText("Settings")).toBeVisible();
    await expect(canvas.getByText("Sidebar content")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Time" })).toBeVisible();
    await expect(canvas.getByText("Page content")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Open / })).toBeNull();
    await expect(screen.queryByRole("contentinfo")).toBeNull();
    await expect(navbar.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects/overview",
    );
    await expect(navbar.getByRole("link", { name: "Time", current: "page" })).toBeVisible();
  },
};

export const Medium: Story = {
  ...atViewport("medium"),
  play: async ({ canvas, globals }) => {
    await expectWindow(canvas, "medium", globals);
    await expect(canvasRoot(canvas)).toHaveAttribute("data-layout-step", "medium");
    await expectNavigationLinks(within(navbarOf(canvas)));
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(56);
    await expect(within(navbar).queryByText("Projects")).toBeNull();
    await expect(within(navbar).getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(canvas.getByText("Sidebar content")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Open / })).toBeNull();
  },
};

export const UsesTheGivenWidths: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: false, expandedWidth: 260 }, moduleSidebarWidth: 300 },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(260);
    await expect(
      widthOf(canvas.getByText("Sidebar content").closest(".mantine-Splitter-pane")!),
    ).toBe(300);
  },
};

export const OnlyTheContentBelowTheHeaderScrolls: Story = {
  ...atViewport("wide"),
  args: { children: <div data-testid="tall" style={{ height: 3000 }} /> },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("heading", { name: "Time" });
    const top = heading.getBoundingClientRect().top;
    const viewport = canvas.getByTestId("tall").closest(".mantine-ScrollArea-viewport");
    if (viewport === null) throw new Error("the content is not in a ScrollArea");
    viewport.scrollTop = 400;
    await expect(viewport.scrollTop).toBe(400);
    await expect(heading.getBoundingClientRect().top).toBe(top);
    await expect(document.documentElement.scrollHeight).toBe(document.documentElement.clientHeight);
  },
};

export const HeaderShowsItsSlots: Story = {
  ...atViewport("wide"),
  args: { channelBadge: <span>Nightly</span>, headerEnd: <button type="button">Slot</button> },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nightly")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Slot" })).toBeVisible();
  },
};

export const Narrow: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas, globals }) => {
    await expectWindow(canvas, "narrow", globals);
    await expect(canvasRoot(canvas)).toHaveAttribute("data-layout-step", "narrow");
    await expectContentFillsTheFrame(canvas, SHELL_REFERENCE_WIDTHS.narrow);
    await expect(canvas.queryByText("Sidebar content")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog", { name: "Module Sidebar" });
    await waitFor(() => expect(within(drawer).getByText("Sidebar content")).toBeVisible());
    await userEvent.click(within(drawer).getByRole("button", { name: "Close navigation" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/** The smallest Electron window: Mantine's phone rule must not reach it. */
export const NarrowAtExactlyTheMinimumWindowWidth: Story = {
  ...atViewport("narrowest"),
  play: async ({ canvas }) => {
    await expect(canvasRoot(canvas)).toHaveAttribute("data-layout-step", "narrow");
    await expectContentFillsTheFrame(canvas, SHELL_REFERENCE_WIDTHS.narrowest);
    await expect(screen.queryByRole("contentinfo")).toBeNull();
  },
};

export const Phone: Story = {
  ...atViewport("phone"),
  args: {
    channelBadge: <span>Nightly</span>,
  },
  play: async ({ canvas, globals }) => {
    await expectWindow(canvas, "phone", globals);
    await expect(canvasRoot(canvas)).toHaveAttribute("data-layout-step", "phone");
    await expect(paneOf(canvas, "Page content").getBoundingClientRect().top).toBeCloseTo(8, 0);
    await expect(canvas.queryByRole("separator")).toBeNull();
    await expect(canvas.queryByText("Sidebar content")).toBeNull();
    await expect(canvas.getByText("Nightly")).toBeVisible();
    const bottomBar = within(screen.getByRole("contentinfo"));
    await expectNavigationLinks(bottomBar);
    const names = bottomBar.getAllByRole("link").map((entry) => entry.textContent);
    await expect(names).toEqual(["Projects", "Time", "Third module", "Settings"]);
    await expect(bottomBar.getByRole("link", { name: "Time", current: "page" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Open module sidebar" })).toBeVisible();
    await userEvent.click(bottomBar.getByRole("link", { name: "Projects" }));
    await expect(bottomBar.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects/overview",
    );
    await expect(
      canvas.queryAllByRole("navigation", { name: "Modules", hidden: true }),
    ).toHaveLength(1);
  },
};

export const WideDark = inDark(Wide);

export const MediumDark = inDark(Medium);

export const NarrowDark = inDark(Narrow);

export const PhoneDark = inDark(Phone);

/** Many modules: nothing is cut off, the bar scrolls sideways. */
export const BottomBarScrollsSideways: Story = {
  ...atViewport("phone"),
  args: {
    contributions: Array.from({ length: 12 }, (_, index) => ({
      id: `module-${index}`,
      name: { id: `module-${index}`, message: `Module ${index}` },
      views: [
        {
          id: "overview",
          title: { id: "overview", message: "Overview" },
          load: async () => ({ default: () => null }),
        },
      ] as const,
      icon: ProjectsIcon,
      color: "blue" as const,
    })),
  },
  play: async () => {
    const viewport = screen
      .getByRole("contentinfo")
      .querySelector<HTMLElement>(".mantine-ScrollArea-viewport");
    if (viewport === null) throw new Error("the bottom bar is not in a ScrollArea");
    await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    await expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
  },
};

export const ContentStaysMountedAcrossLayoutSteps: Story = {
  ...atViewport("wide"),
  args: { children: <input aria-label="Draft" /> },
  play: async ({ canvas }) => {
    const draft = canvas.getByRole("textbox", { name: "Draft" });
    await userEvent.type(draft, "unsaved");
    for (const [width, button, step] of [
      [SHELL_REFERENCE_WIDTHS.medium, null, "medium"],
      [SHELL_REFERENCE_WIDTHS.narrow, "Open navigation", "narrow"],
      [390, "Open module sidebar", "phone"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- the steps are walked one after the other
      await atFrameWidth(width, async () => {
        await waitFor(async () => {
          await expect(canvasRoot(canvas)).toHaveAttribute("data-layout-step", step);
          if (button !== null)
            await expect(canvas.getByRole("button", { name: button })).toBeVisible();
          else await expect(widthOf(navbarOf(canvas))).toBe(56);
        });
        await expect(canvas.getByRole("textbox", { name: "Draft" })).toBe(draft);
        await expect(draft).toHaveValue("unsaved");
      });
    }
  },
};

/** The Navbar leaves and comes back at this step, and the page beside it must not notice. */
export const ContentStaysMountedAcrossTheNarrowStep: Story = {
  ...atViewport("medium"),
  args: { children: <input aria-label="Draft" /> },
  play: async ({ canvas }) => {
    const draft = canvas.getByRole("textbox", { name: "Draft" });
    await userEvent.type(draft, "unsaved");
    const expectDraftKept = async () => {
      await expect(canvas.getByRole("textbox", { name: "Draft" })).toBe(draft);
      await expect(draft).toHaveValue("unsaved");
    };
    const navbarIsThere = () => expect(canvas.queryByRole("navigation")).not.toBeNull();
    const navbarIsGone = () => expect(canvas.queryByRole("navigation")).toBeNull();
    await waitFor(navbarIsThere);
    await atFrameWidth(SHELL_REFERENCE_WIDTHS.narrow, async () => {
      await waitFor(navbarIsGone);
      await expectDraftKept();
      await atFrameWidth(SHELL_REFERENCE_WIDTHS.medium, async () => {
        await waitFor(navbarIsThere);
        await expectDraftKept();
      });
      await waitFor(navbarIsGone);
      await expectDraftKept();
      await atFrameWidth(390, async () => {
        await waitFor(() => expect(screen.getByRole("contentinfo")).toBeVisible());
        await expectDraftKept();
      });
      await waitFor(() => expect(screen.queryByRole("contentinfo")).toBeNull());
      await expectDraftKept();
    });
    await waitFor(navbarIsThere);
    await expectDraftKept();
  },
};

export const TheBackgroundReachesTheWindowEdge: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const root = canvasRoot(canvas);
    await expect(root.getBoundingClientRect()).toMatchObject({ top: 0, left: 0 });
    await expect(root.getBoundingClientRect().width).toBe(document.documentElement.clientWidth);
    await expect(root.getBoundingClientRect().height).toBe(window.innerHeight);
  },
};

export const SurfacesUseTheirColorRoles: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const roleOf = (name: string) => getComputedStyle(navbar).getPropertyValue(name);
    await expect(navbar).toHaveStyle({ backgroundColor: roleOf("--se-nav-surface") });
    await expect(navbar.parentElement).toHaveStyle({ backgroundColor: roleOf("--se-chrome") });
    await expect(canvas.getByText("Sidebar content").closest(".mantine-Splitter-pane")).toHaveStyle(
      { backgroundColor: roleOf("--se-nav-surface") },
    );
    await expect(
      canvas.getByRole("heading", { name: "Time" }).closest(".mantine-Splitter-pane"),
    ).toHaveStyle({ backgroundColor: roleOf("--se-canvas") });
  },
};

export const WidthsAboveTheLimitsShowTheMaximum: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: false, expandedWidth: 9000 }, moduleSidebarWidth: 9000 },
  play: ({ args, canvas }) =>
    expectShownWithoutReport(canvas, args, { navbar: 280, moduleSidebar: 360 }),
};

export const WidthsBelowTheLimitsShowTheMinimum: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: false, expandedWidth: 10 }, moduleSidebarWidth: 10 },
  play: ({ args, canvas }) =>
    expectShownWithoutReport(canvas, args, { navbar: 168, moduleSidebar: 200 }),
};
