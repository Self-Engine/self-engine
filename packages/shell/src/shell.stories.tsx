import { MantineThemeProvider } from "@mantine/core";
import { ProjectsIcon, SettingsIcon, TimeIcon } from "@self-engine/icons";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Shell, type ShellEntry, type ShellProps } from "./index.ts";

const ENTRIES: readonly ShellEntry[] = [
  { id: "projects", label: "Projects", icon: ProjectsIcon, color: "blue" },
  { id: "time", label: "Time", icon: TimeIcon, color: "teal" },
];

const SETTINGS: ShellEntry = {
  id: "settings",
  label: "Settings",
  icon: SettingsIcon,
  color: "grape",
};

/** One real window width per Layout Step, around Mantine's own breakpoints. */
const VIEWPORTS = {
  wide: { name: "Wide", styles: { width: "1280px", height: "800px" } },
  medium: { name: "Medium", styles: { width: "1100px", height: "800px" } },
  narrow: { name: "Narrow", styles: { width: "800px", height: "800px" } },
  narrowest: { name: "Narrowest", styles: { width: "576px", height: "800px" } },
  phone: { name: "Phone", styles: { width: "390px", height: "800px" } },
};

function atViewport(value: keyof typeof VIEWPORTS) {
  return { globals: { viewport: { value, isRotated: false } } };
}

const meta = {
  title: "Shell/Shell",
  component: Shell,
  parameters: { layout: "fullscreen", viewport: { options: VIEWPORTS } },
  args: {
    activeEntryId: "time",
    children: <p>Page content</p>,
    entries: ENTRIES,
    moduleSidebar: <p>Sidebar content</p>,
    onSelectEntry: fn(),
    pageTitle: "Time",
    settingsEntry: SETTINGS,
  },
} satisfies Meta<ShellProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Wide: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const navbar = within(canvas.getByRole("navigation", { name: "Modules" }));
    await expect(navbar.getByText("Projects")).toBeVisible();
    await expect(navbar.getByText("Settings")).toBeVisible();
    await expect(canvas.getByText("Sidebar content")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Time" })).toBeVisible();
    await expect(canvas.getByText("Page content")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Open module sidebar" })).toBeNull();
    await expect(screen.queryByRole("contentinfo")).toBeNull();
    await userEvent.click(navbar.getByRole("button", { name: "Projects" }));
    await expect(meta.args.onSelectEntry).toHaveBeenCalledWith("projects");
  },
};

function navbarOf(canvas: ReturnType<typeof within>): HTMLElement {
  return canvas.getByRole("navigation", { name: "Modules" });
}

/** Rendered widths, rounded: subpixel layout must not fail a story. */
function widthOf(element: Element): number {
  return Math.round(element.getBoundingClientRect().width);
}

export const NavbarIsWideAtTheWideStep: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(220);
    await expect(
      widthOf(canvas.getByText("Sidebar content").closest(".mantine-Splitter-pane")!),
    ).toBe(240);
  },
};

export const Medium: Story = {
  ...atViewport("medium"),
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(68);
    await expect(within(navbar).queryByText("Projects")).toBeNull();
    await expect(within(navbar).getByRole("button", { name: "Projects" })).toBeVisible();
    await expect(canvas.getByText("Sidebar content")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Open module sidebar" })).toBeNull();
  },
};

export const IconsOnlyEntriesShowTheirNameInATooltip: Story = {
  ...atViewport("medium"),
  play: async ({ canvas }) => {
    await userEvent.hover(canvas.getByRole("button", { name: "Projects" }));
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("Projects");
  },
};

export const ActiveEntryIsMarkedInItsModuleColor: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const active = canvas.getByRole("button", { name: "Time", current: "page" });
    const scope = getComputedStyle(active);
    await expect(active).toHaveStyle({
      backgroundColor: scope.getPropertyValue("--se-module-soft"),
    });
    await expect(canvas.getByRole("button", { name: "Projects" })).not.toHaveAttribute(
      "aria-current",
    );
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

export const CollapsedNavbarShowsIconsOnlyEvenWhenWide: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(68);
    await expect(within(navbar).queryByText("Projects")).toBeNull();
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
  args: { channelBadge: <span>Nightly</span>, headerEnd: <button type="button">Search</button> },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nightly")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Search" })).toBeVisible();
  },
};

export const Narrow: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(68);
    await expect(canvas.queryByText("Sidebar content")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Open module sidebar" }));
    const drawer = await screen.findByRole("dialog", { name: "Module Sidebar" });
    await waitFor(() => expect(within(drawer).getByText("Sidebar content")).toBeVisible());
    await userEvent.click(within(drawer).getByRole("button", { name: "Close module sidebar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/** The smallest Electron window: Mantine's phone rule must not reach it. */
export const NarrowAtExactlyTheMinimumWindowWidth: Story = {
  ...atViewport("narrowest"),
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(navbar).toBeVisible();
    await expect(widthOf(navbar)).toBe(68);
    await expect(navbar.getBoundingClientRect().left).toBe(8);
    await expect(widthOf(canvas.getByRole("main"))).toBeLessThan(576 - 68);
    await expect(screen.queryByRole("contentinfo")).toBeNull();
  },
};

export const Phone: Story = {
  ...atViewport("phone"),
  args: {
    channelBadge: <span>Nightly</span>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("Sidebar content")).toBeNull();
    await expect(canvas.getByText("Nightly")).toBeVisible();
    const bottomBar = within(screen.getByRole("contentinfo"));
    const names = bottomBar.getAllByRole("button").map((entry) => entry.textContent);
    await expect(names).toEqual(["Projects", "Time", "Settings"]);
    await expect(bottomBar.getByRole("button", { name: "Time", current: "page" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Open module sidebar" })).toBeVisible();
    await userEvent.click(bottomBar.getByRole("button", { name: "Projects" }));
    await expect(meta.args.onSelectEntry).toHaveBeenCalledWith("projects");
    await expect(
      canvas.queryAllByRole("navigation", { name: "Modules", hidden: true }),
    ).toHaveLength(1);
  },
};

/** Many modules: nothing is cut off, the bar scrolls sideways. */
export const BottomBarScrollsSideways: Story = {
  ...atViewport("phone"),
  args: {
    entries: Array.from({ length: 12 }, (_, index) => ({
      id: `module-${index}`,
      label: `Module ${index}`,
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

/** Resizes the frame the story runs in, which is the window for its media queries. */
async function atFrameWidth(width: number, change: () => Promise<void>): Promise<void> {
  // Not `instanceof`: the frame element belongs to the parent window's realm.
  const frame = window.frameElement as HTMLElement | null;
  if (frame === null) throw new Error("the story does not run in a frame");
  const previous = frame.style.width;
  frame.style.width = `${width}px`;
  try {
    await change();
  } finally {
    frame.style.width = previous;
  }
}

export const ContentStaysMountedAcrossLayoutSteps: Story = {
  ...atViewport("wide"),
  args: { children: <input aria-label="Draft" /> },
  play: async ({ canvas }) => {
    const draft = canvas.getByRole("textbox", { name: "Draft" });
    await userEvent.type(draft, "unsaved");
    for (const [width, button] of [
      [1100, null],
      [800, "Open module sidebar"],
      [390, "Open module sidebar"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- the steps are walked one after the other
      await atFrameWidth(width, async () => {
        await waitFor(async () => {
          if (button !== null)
            await expect(canvas.getByRole("button", { name: button })).toBeVisible();
          else await expect(widthOf(navbarOf(canvas))).toBe(68);
        });
        await expect(canvas.getByRole("textbox", { name: "Draft" })).toBe(draft);
        await expect(draft).toHaveValue("unsaved");
      });
    }
  },
};

export const WidenedWindowClosesTheDrawer: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open module sidebar" }));
    await screen.findByRole("dialog", { name: "Module Sidebar" });
    await atFrameWidth(1100, async () => {
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Open module sidebar" })).toBeVisible(),
    );
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};

export const StripForTheWindowButtons: Story = {
  ...atViewport("wide"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const first = canvas.getByRole("button", { name: "Projects" });
    await expect(first.getBoundingClientRect().top).toBeGreaterThanOrEqual(40);
  },
};

export const NoStripWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const first = canvas.getByRole("button", { name: "Projects" });
    await expect(first.getBoundingClientRect().top).toBeLessThan(40);
  },
};

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

export const LabelsAreTranslated: Story = {
  globals: { ...atViewport("narrow").globals, language: "de" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Module" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Modul-Sidebar öffnen" }));
    const drawer = await screen.findByRole("dialog", { name: "Modul-Sidebar" });
    await expect(
      within(drawer).getByRole("button", { name: "Modul-Sidebar schließen" }),
    ).toBeVisible();
  },
};
