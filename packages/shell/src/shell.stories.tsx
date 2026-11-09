import { MantineThemeProvider } from "@mantine/core";
import { ProjectsIcon, SettingsIcon, TimeIcon } from "@self-engine/icons";
import { BrandMark } from "@self-engine/icons/brand-mark";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import {
  Shell,
  SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  SHELL_STANDARD_NAVBAR,
  type ShellEntry,
  type ShellProps,
} from "./index.ts";

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
    onModuleSidebarCollapsedCommit: fn(),
    onModuleSidebarWidthCommit: fn(),
    onNavbarCommit: fn(),
    onSelectEntry: fn(),
    pageTitle: "Time",
    settingsEntry: SETTINGS,
  },
} satisfies Meta<ShellProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The largest channel of a computed color, which tells a dark surface from a light one. */
function brightnessOf(color: string): number {
  return Math.max(
    ...color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number),
  );
}

/** The window really has the width of its Layout Step, and the frame the story's Color Mode. */
async function expectWindow(
  canvas: ReturnType<typeof within>,
  viewport: keyof typeof VIEWPORTS,
  { colorMode }: Readonly<Record<string, unknown>>,
): Promise<void> {
  await expect(`${window.innerWidth}px`).toBe(VIEWPORTS[viewport].styles.width);
  await expect(document.documentElement).toHaveAttribute(
    "data-mantine-color-scheme",
    String(colorMode),
  );
  for (const surface of [canvasRoot(canvas), paneOf(canvas, "Page content")]) {
    const brightness = brightnessOf(getComputedStyle(surface).backgroundColor);
    // oxlint-disable-next-line no-await-in-loop -- one assertion per surface, in order
    await expect(colorMode === "dark" ? brightness < 64 : brightness > 200).toBe(true);
  }
}

const inDark = (story: Story): Story => ({
  ...story,
  globals: { ...story.globals, colorMode: "dark" },
});

export const Wide: Story = {
  ...atViewport("wide"),
  play: async ({ canvas, globals }) => {
    await expectWindow(canvas, "wide", globals);
    const navbar = within(canvas.getByRole("navigation", { name: "Modules" }));
    await expect(navbar.getByText("Projects")).toBeVisible();
    await expect(navbar.getByText("Settings")).toBeVisible();
    await expect(canvas.getByText("Sidebar content")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Time" })).toBeVisible();
    await expect(canvas.getByText("Page content")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Open / })).toBeNull();
    await expect(screen.queryByRole("contentinfo")).toBeNull();
    await userEvent.click(navbar.getByRole("button", { name: "Projects" }));
    await expect(meta.args.onSelectEntry).toHaveBeenCalledWith("projects");
  },
};

function navbarOf(canvas: ReturnType<typeof within>): HTMLElement {
  return canvas.getByRole("navigation", { name: "Modules" });
}

function canvasRoot(canvas: ReturnType<typeof within>): HTMLElement {
  return canvas.getByRole("main").parentElement!;
}

/** The narrow step: no Navbar in the frame, and the content has the outer gap on both sides. */
async function expectContentFillsTheFrame(
  canvas: ReturnType<typeof within>,
  windowWidth: number,
): Promise<void> {
  await expect(canvas.queryByRole("navigation", { name: "Modules" })).toBeNull();
  await expect(canvasRoot(canvas).querySelector(".mantine-AppShell-header")).toBeNull();
  const content = paneOf(canvas, "Page content").getBoundingClientRect();
  await expect(content.top).toBeCloseTo(8, 0);
  await expect(content.left).toBeCloseTo(8, 0);
  await expect(content.right).toBeCloseTo(windowWidth - 8, 0);
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
  play: async ({ canvas, globals }) => {
    await expectWindow(canvas, "medium", globals);
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(56);
    await expect(within(navbar).queryByText("Projects")).toBeNull();
    await expect(within(navbar).getByRole("button", { name: "Projects" })).toBeVisible();
    await expect(canvas.getByText("Sidebar content")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^Open / })).toBeNull();
  },
};

/** The 56 px Navbar has 36 px inside its padding, so the mark of the active entry is 36 × 40. */
async function expectActiveEntryFillsTheColumn(active: HTMLElement): Promise<void> {
  await expect(Math.round(active.getBoundingClientRect().width)).toBe(36);
  await expect(Math.round(active.getBoundingClientRect().height)).toBe(40);
}

export const TheActiveEntryOfTheIconsOnlyNavbarIs36By40: Story = {
  ...atViewport("medium"),
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expectActiveEntryFillsTheColumn(
      canvas.getByRole("button", { name: "Time", current: "page" }),
    );
  },
};

export const TheActiveEntryIs36By40WhenTheUserCollapsedTheNavbarToo: Story = {
  ...atViewport("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 } },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expectActiveEntryFillsTheColumn(
      canvas.getByRole("button", { name: "Time", current: "page" }),
    );
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
    await expect(widthOf(navbar)).toBe(56);
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
  play: async ({ canvas, globals }) => {
    await expectWindow(canvas, "narrow", globals);
    await expectContentFillsTheFrame(canvas, 800);
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
    await expectContentFillsTheFrame(canvas, 576);
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
    await expect(paneOf(canvas, "Page content").getBoundingClientRect().top).toBeCloseTo(8, 0);
    await expect(canvas.queryByRole("separator")).toBeNull();
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

export const WideDark = inDark(Wide);

export const MediumDark = inDark(Medium);

export const NarrowDark = inDark(Narrow);

export const PhoneDark = inDark(Phone);

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
      [800, "Open navigation"],
      [390, "Open module sidebar"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- the steps are walked one after the other
      await atFrameWidth(width, async () => {
        await waitFor(async () => {
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
    await atFrameWidth(800, async () => {
      await waitFor(navbarIsGone);
      await expectDraftKept();
      await atFrameWidth(1100, async () => {
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

export const WidenedWindowClosesTheDrawer: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open navigation" }));
    await screen.findByRole("dialog", { name: "Module Sidebar" });
    await atFrameWidth(1100, async () => {
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Open navigation" })).toBeVisible(),
    );
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};

export const StripForTheWindowButtons: Story = {
  ...atViewport("wide"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const first = canvas.getByRole("button", { name: "Projects" });
    await expect(first.getBoundingClientRect().top).toBeCloseTo(
      navbarOf(canvas).getBoundingClientRect().top + 48,
      0,
    );
    await expect(appRegionOf(navbarOf(canvas).firstElementChild!)).toBe("drag");
  },
};

/**
 * The window buttons end 76 px from the window edge, past a 56 px Navbar, so the strip has to run
 * on over the Module Sidebar. Nothing but the drag region may sit under them.
 */
async function expectStripOverAnIconsOnlyNavbar(canvas: ReturnType<typeof within>): Promise<void> {
  const navbar = navbarOf(canvas);
  await expect(widthOf(navbar)).toBe(56);
  await expectContainersReachTheTop(canvas);
  await expect(appRegionOf(navbar.firstElementChild!)).toBe("drag");
  await expect(Math.round(navbar.firstElementChild!.getBoundingClientRect().height)).toBe(
    STRIP_HEIGHT,
  );
  await expectEntriesBelowTheStrip(canvas);
  const pane = paneOf(canvas, "Sidebar content");
  await expect(appRegionOf(pane.firstElementChild!)).toBe("drag");
  await expect(Math.round(pane.firstElementChild!.getBoundingClientRect().height)).toBe(
    STRIP_HEIGHT,
  );
  await expect(canvas.getByText("Sidebar content").getBoundingClientRect().top).toBeGreaterThan(
    pane.getBoundingClientRect().top + STRIP_HEIGHT,
  );
}

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

const centerY = (element: Element) => {
  const { top, height } = element.getBoundingClientRect();
  return top + height / 2;
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

const appRegionOf = (element: Element) =>
  getComputedStyle(element).getPropertyValue("-webkit-app-region");

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

export const TheDrawerStaysClickableAboveTheDragRegion: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog", { name: "Module Sidebar" });
    await expect(appRegionOf(drawer)).toBe("no-drag");
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

export const NoStripWithoutWindowButtonsOrLogo: Story = {
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

/** Holds the widths the way the app does, so a commit shows up in the next render. */
function ResizableShell(args: ShellProps) {
  const [navbar, setNavbar] = useState(args.navbar ?? SHELL_STANDARD_NAVBAR);
  const [moduleSidebarCollapsed, setModuleSidebarCollapsed] = useState(
    args.moduleSidebarCollapsed ?? false,
  );
  const [width, setWidth] = useState(
    args.moduleSidebarWidth ?? SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  );
  return (
    <Shell
      {...args}
      moduleSidebarCollapsed={moduleSidebarCollapsed}
      moduleSidebarWidth={width}
      navbar={navbar}
      onModuleSidebarCollapsedCommit={(next) => {
        args.onModuleSidebarCollapsedCommit?.(next);
        setModuleSidebarCollapsed(next);
      }}
      onModuleSidebarWidthCommit={(next) => {
        args.onModuleSidebarWidthCommit?.(next);
        setWidth(next);
      }}
      onNavbarCommit={(next) => {
        args.onNavbarCommit?.(next);
        setNavbar(next);
      }}
    />
  );
}

const resizable = { render: (args: ShellProps) => <ResizableShell {...args} /> };

const navbarHandle = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("separator", { name: "Resize navbar" });

const paneOf = (canvas: ReturnType<typeof within>, text: string) => {
  const pane = canvas.getByText(text).closest(".mantine-Splitter-pane");
  if (pane === null) throw new Error(`"${text}" is not in a pane`);
  return pane;
};

async function expectReportedOnce(callback: unknown, value: unknown): Promise<void> {
  await expect(callback).toHaveBeenCalledTimes(1);
  await expect(callback).toHaveBeenCalledWith(value);
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Real pointer events with exact coordinates, which `userEvent` does not promise in a browser. */
async function pressHandle(handle: HTMLElement) {
  const { left, top, width } = handle.getBoundingClientRect();
  const startX = left + width / 2;
  const fire = (type: string, x: number) =>
    handle.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: top + 100,
        pointerId: 1,
      }),
    );
  fire("pointerdown", startX);
  await nextFrame();
  return {
    moveBy: async (distance: number) => {
      fire("pointermove", startX + distance);
      await nextFrame();
      await nextFrame();
    },
    /** Moves there first, as a real release does. */
    release: async (distance: number) => {
      fire("pointermove", startX + distance);
      await nextFrame();
      fire("pointerup", startX + distance);
      await nextFrame();
      await nextFrame();
    },
  };
}

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

/** The real font scale, through the Catalog's toolbar global. */
const wideAt112Percent = { globals: { ...atViewport("wide").globals, fontScale: "112.5" } };

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

export const EntriesKeepTheirGeometryWhenTheLabelGoes: Story = {
  ...atViewport("wide"),
  ...resizable,
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const entry = () => within(navbar).getByRole("button", { name: "Projects" });
    const geometry = () => {
      const icon = entry().querySelector("svg")!.getBoundingClientRect();
      return { height: entry().getBoundingClientRect().height, iconLeft: icon.left };
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

const LOGO = { mark: <svg data-testid="mark" height={28} width={28} />, name: "Self-Engine" };

const centerX = (element: Element) => {
  const { left, width } = element.getBoundingClientRect();
  return left + width / 2;
};

const brandPlace = (canvas: ReturnType<typeof within>) => {
  const mark = canvas.getByTestId("mark").getBoundingClientRect();
  const name = canvas.getByText("Self-Engine").getBoundingClientRect();
  return { markLeft: mark.left, markTop: mark.top, nameLeft: name.left };
};

export const LogoDoesNotMoveWithTheNavbar: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO, reserveWindowButtons: true },
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
  args: { logo: LOGO, reserveWindowButtons: true },
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
      centerX(canvas.getByRole("button", { name: "Projects" }).querySelector("svg")!),
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
  args: { logo: LOGO, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
  },
};

const STRIP_HEIGHT = 48;

const dividerIn = (navbar: Element) => {
  const divider = [...navbar.children].find((child) => widthOf(child) === 1);
  if (divider === undefined) throw new Error("the Navbar has no divider");
  return divider;
};

const dividerOf = (canvas: ReturnType<typeof within>) => dividerIn(navbarOf(canvas));

export const TheStripReadsAsOneSurface: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO, reserveWindowButtons: true },
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

export const TheDividerRunsTheFullHeightWithoutAStrip: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    await expect(dividerOf(canvas).getBoundingClientRect().top).toBeCloseTo(
      navbarOf(canvas).getBoundingClientRect().top,
      0,
    );
  },
};

export const TheStripStaysForTheLogoWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const firstEntry = canvas.getByRole("button", { name: "Projects" });
    await expect(firstEntry.getBoundingClientRect().top).toBeCloseTo(
      navbarOf(canvas).getBoundingClientRect().top + STRIP_HEIGHT,
      0,
    );
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

/** The real font scale, through the Catalog's toolbar global. */
const atSmallestFontScale = (viewport: keyof typeof VIEWPORTS) => ({
  globals: { ...atViewport(viewport).globals, fontScale: "87.5" },
});

/** 56 px at the standard scale while the Module Sidebar is open: the buttons sit in its strip. */
export const TheIconsOnlyNavbarFollowsTheFontScaleWithWindowButtons: Story = {
  ...atSmallestFontScale("medium"),
  args: { reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(navbar.getBoundingClientRect().width).toBeCloseTo(49, 0);
    const icon = canvas.getByRole("button", { name: "Projects" }).querySelector("svg")!;
    await expect(centerX(icon)).toBeCloseTo(centerX(navbar), 0);
  },
};

export const IconsOnlyEntriesFitAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("medium"),
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    const entry = canvas.getByRole("button", { name: "Projects" });
    const entryBox = entry.getBoundingClientRect();
    const icon = entry.querySelector("svg")!.getBoundingClientRect();
    await expect(icon.left).toBeGreaterThanOrEqual(entryBox.left);
    await expect(icon.right).toBeLessThanOrEqual(entryBox.right);
    await expect(entryBox.right).toBeLessThanOrEqual(navbar.getBoundingClientRect().right);
    await expect(icon.left + icon.width / 2).toBeCloseTo(centerX(navbar), 0);
  },
};

export const ACollapsedNavbarFollowsTheFontScaleWithWindowButtons: Story = {
  ...atSmallestFontScale("wide"),
  args: { navbar: { collapsed: true, expandedWidth: 260 }, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(49, 0);
  },
};

async function openDrawer(
  canvas: ReturnType<typeof within>,
  burger = "Open navigation",
): Promise<HTMLElement> {
  await userEvent.click(canvas.getByRole("button", { name: burger }));
  const drawer = await screen.findByRole("dialog", { name: "Module Sidebar" });
  await waitFor(() => expect(within(drawer).getByText("Sidebar content")).toBeVisible());
  return drawer;
}

const drawerHeaderOf = (drawer: HTMLElement) => {
  const header = drawer.querySelector(".mantine-Drawer-header");
  if (header === null) throw new Error("the Drawer has no header");
  return header;
};

const drawerNavbarOf = (drawer: HTMLElement) =>
  within(drawer).getByRole("navigation", { name: "Modules" });

/** The native buttons float above the Drawer too, so its title has to start below them. */
export const TheDrawerHeaderSitsBelowTheStripWithWindowButtons: Story = {
  ...atViewport("narrow"),
  args: { logo: LOGO, moduleSidebarWidth: 320, reserveWindowButtons: true },
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
    await waitFor(() => expect(mark.getBoundingClientRect().left).toBeCloseTo(84, 0));
    await expect(
      within(drawer).getByText("Self-Engine").getBoundingClientRect().right,
    ).toBeLessThan(drawer.getBoundingClientRect().right);
  },
};

/** The whole navigation of the frame, side by side under the strip. */
export const TheDrawerShowsTheNavbarBesideTheModuleSidebar: Story = {
  ...atViewport("narrow"),
  args: { logo: LOGO, moduleSidebarWidth: 320, reserveWindowButtons: true },
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
      .getAllByRole("button")
      .map((entry) => entry.getAttribute("aria-label"));
    await expect(names).toEqual(["Projects", "Time", "Settings"]);
    const settings = within(navbar).getByRole("button", { name: "Settings" });
    await expect(settings.getBoundingClientRect().bottom).toBeCloseTo(box.bottom - 10, 0);
    const icon = settings.querySelector("svg")!;
    await expect(centerX(icon)).toBeCloseTo(centerX(navbar), 0);
    const header = drawerHeaderOf(drawer).getBoundingClientRect();
    await expect(header.left).toBeCloseTo(box.right, 0);
    await expect(header.right).toBeCloseTo(drawer.getBoundingClientRect().right, 0);
    await expect(within(drawer).getByRole("button", { name: "Close navigation" })).toBeVisible();
    await expect(within(drawer).getByText("Sidebar content").getBoundingClientRect().left).toBe(
      header.left + 16,
    );
  },
};

export const TheDrawerDividerStartsBelowTheStripAndLooksLikeTheFrame: Story = {
  ...atViewport("narrow"),
  args: { logo: LOGO, reserveWindowButtons: true },
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
    await userEvent.click(navbar.getByRole("button", { name: "Projects" }));
    await expect(meta.args.onSelectEntry).toHaveBeenCalledWith("projects");
    await userEvent.click(navbar.getByRole("button", { name: "Settings" }));
    await expect(meta.args.onSelectEntry).toHaveBeenLastCalledWith("settings");
    await expect(screen.getByRole("dialog", { name: "Module Sidebar" })).toBe(drawer);
    await expect(within(drawer).getByText("Sidebar content")).toBeVisible();
  },
};

export const TheDrawerNavbarNamesItsEntriesAndMarksTheActiveOne: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const navbar = within(drawerNavbarOf(drawer));
    const active = navbar.getByRole("button", { name: "Time", current: "page" });
    await expect(active).toHaveStyle({
      backgroundColor: getComputedStyle(active).getPropertyValue("--se-module-soft"),
    });
    await expectActiveEntryFillsTheColumn(active);
    await userEvent.hover(navbar.getByRole("button", { name: "Projects" }));
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("Projects");
  },
};

export const TheDrawerLogoStartsAtTheLeftEdgeWithoutWindowButtons: Story = {
  ...atViewport("narrow"),
  args: { logo: LOGO },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const mark = within(drawer).getByTestId("mark");
    const firstEntry = within(drawerNavbarOf(drawer)).getByRole("button", { name: "Projects" });
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
  args: { logo: LOGO, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    await waitFor(() =>
      expect(within(drawer).getByTestId("mark").getBoundingClientRect().left).toBeCloseTo(84, 0),
    );
    await expect(
      within(drawer).getByText("Self-Engine").getBoundingClientRect().right,
    ).toBeLessThan(drawer.getBoundingClientRect().right);
  },
};

export const TheDrawerHeaderStaysBelowTheStripWhenTheSidebarScrolls: Story = {
  ...atViewport("narrow"),
  args: {
    logo: LOGO,
    moduleSidebar: <p style={{ height: 3000 }}>Sidebar content</p>,
    reserveWindowButtons: true,
  },
  play: async ({ canvas }) => {
    const drawer = await openDrawer(canvas);
    const header = drawerHeaderOf(drawer);
    const firstEntry = within(drawerNavbarOf(drawer)).getByRole("button", { name: "Projects" });
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
    await expect(within(drawer).queryByRole("navigation")).toBeNull();
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

const burgerOf = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("button", { name: "Open navigation" });

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

const sidebarHandle = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("separator", { name: "Resize module sidebar" });

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

const collapseToggle = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("button", { name: "Collapse module sidebar" });

const expandToggle = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("button", { name: "Expand module sidebar" });

const queryCollapseToggle = (canvas: ReturnType<typeof within>) =>
  canvas.queryByRole("button", { name: /(Collapse|Expand) module sidebar/ });

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
  args: { children: <input aria-label="Draft" />, logo: LOGO, reserveWindowButtons: true },
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

/** The drawer steps have their own way to the Module Sidebar, whatever the user set above them. */
export const TheCollapsedStateDoesNotReachTheNarrowDrawer: Story = {
  ...atViewport("narrow"),
  args: { moduleSidebarCollapsed: true },
  play: async ({ canvas }) => {
    await expectContentFillsTheFrame(canvas, 800);
    await openDrawer(canvas);
  },
};

/** The macOS state with both collapsed: Module Sidebar closed and the Navbar icons-only. */
const BOTH_COLLAPSED = {
  logo: LOGO,
  moduleSidebarCollapsed: true,
  navbar: { collapsed: true, expandedWidth: 260 },
  reserveWindowButtons: true,
};

/** The rail ends 8 px after the window buttons, which end 76 px from the window edge. */
const expectRailHoldsTheWindowButtons = async (
  canvas: ReturnType<typeof within>,
): Promise<void> => {
  await expect(navbarOf(canvas).getBoundingClientRect().right).toBeCloseTo(84, 0);
};

/** Centered on the wider rail, in the geometry an entry has everywhere else. */
const expectEntriesCenteredOnTheRail = async (canvas: ReturnType<typeof within>): Promise<void> => {
  const navbar = navbarOf(canvas);
  for (const entry of within(navbar).getAllByRole("button")) {
    const icon = entry.querySelector("svg")!;
    // oxlint-disable-next-line no-await-in-loop -- one assertion per entry, in order
    await expect(centerX(icon)).toBeCloseTo(centerX(navbar), 0);
  }
};

export const TheRailHoldsTheWindowButtonsWhenBothAreCollapsed: Story = {
  ...atViewport("wide"),
  args: BOTH_COLLAPSED,
  play: async ({ canvas }) => {
    const navbar = navbarOf(canvas);
    await expect(widthOf(navbar)).toBe(76);
    await expectRailHoldsTheWindowButtons(canvas);
    await expectContainersReachTheTop(canvas);
    await expectEntriesBelowTheStrip(canvas);
    await expectEntriesCenteredOnTheRail(canvas);
    const active = canvas.getByRole("button", { name: "Time", current: "page" });
    await expect(widthOf(active)).toBe(36);
    await expect(Math.round(active.getBoundingClientRect().height)).toBe(40);
    await expect([...navbar.children].filter((child) => widthOf(child) === 1)).toEqual([]);
    await expect(navbarHandle(canvas).getBoundingClientRect().top).toBeCloseTo(
      navbar.getBoundingClientRect().top + STRIP_HEIGHT,
      0,
    );
  },
};

/** The buttons float over the middle of the rail, so only its full width leaves room to drag. */
export const TheStripSpansTheRailSoTheWindowStaysDraggable: Story = {
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

export const TheMediumStepWidensTheRailWhenTheModuleSidebarIsClosed: Story = {
  ...atViewport("medium"),
  args: { logo: LOGO, moduleSidebarCollapsed: true, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(76);
    await expectRailHoldsTheWindowButtons(canvas);
    await expectContainersReachTheTop(canvas);
    await expectEntriesBelowTheStrip(canvas);
  },
};

/** The buttons stay in real pixels, so the rail is wider in Mantine's numbers at a smaller scale. */
export const TheRailHoldsTheWindowButtonsAtTheSmallestFontScale: Story = {
  ...atSmallestFontScale("medium"),
  args: { moduleSidebarCollapsed: true, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    // 84 px / 0.875 - 8, at the scale of 0.875.
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(88 * 0.875, 0);
    await expectRailHoldsTheWindowButtons(canvas);
    await expectEntriesCenteredOnTheRail(canvas);
  },
};

export const TheRailHoldsTheWindowButtonsAt112Percent: Story = {
  ...wideAt112Percent,
  args: BOTH_COLLAPSED,
  play: async ({ canvas }) => {
    // 84 px / 1.125 - 8, rounded up, at the scale of 1.125.
    await expect(navbarOf(canvas).getBoundingClientRect().width).toBeCloseTo(67 * 1.125, 0);
    await expectRailHoldsTheWindowButtons(canvas);
    await expectEntriesCenteredOnTheRail(canvas);
  },
};

export const TheRailStaysNarrowWhileTheModuleSidebarIsOpen: Story = {
  ...atViewport("wide"),
  args: { ...BOTH_COLLAPSED, moduleSidebarCollapsed: false },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expect(canvas.getByText("Self-Engine")).toBeVisible();
    await expectContainersReachTheTop(canvas);
  },
};

export const TheRailStaysNarrowWithoutWindowButtons: Story = {
  ...atViewport("wide"),
  args: { ...BOTH_COLLAPSED, reserveWindowButtons: false },
  play: async ({ canvas }) => {
    await expect(widthOf(navbarOf(canvas))).toBe(56);
    await expectContainersReachTheTop(canvas);
  },
};

const headerOf = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("heading", { name: "Time" }).parentElement!.parentElement!;

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
  args: { logo: LOGO, moduleSidebarCollapsed: true, reserveWindowButtons: true },
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
  args: { logo: LOGO, moduleSidebarCollapsed: true, reserveWindowButtons: true },
  play: async ({ canvas }) => {
    await expect(headerOf(canvas).firstElementChild).toBe(expandToggle(canvas));
  },
};

export const TheRailAndTheLogoFollowTheNavbarWhileDragging: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO, moduleSidebarCollapsed: true, reserveWindowButtons: true },
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

/** The midpoint of 76 and 215 is 145.5, where the midpoint of the 56 px rail would be 135.5. */
export const TheMidpointFollowsTheRailThatHoldsTheWindowButtons: Story = {
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

export const TheRailCanBeDraggedWide: Story = {
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

export const ArrowKeysCrossTheGapBetweenTheRailAndWide: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: BOTH_COLLAPSED,
  play: async ({ args, canvas }) => {
    const navbar = navbarOf(canvas);
    navbarHandle(canvas).focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(widthOf(navbar)).toBe(215));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: false,
      expandedWidth: 215,
    });
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(widthOf(navbar)).toBe(76));
    await expect(args.onNavbarCommit).toHaveBeenLastCalledWith({
      collapsed: true,
      expandedWidth: 215,
    });
  },
};

const markPlace = (canvas: ReturnType<typeof within>) => {
  const { left, top } = canvas.getByTestId("mark").getBoundingClientRect();
  return { left, top };
};

const markStaysPutWhenToggling = async (canvas: ReturnType<typeof within>): Promise<void> => {
  const place = markPlace(canvas);
  await userEvent.click(collapseToggle(canvas));
  await waitFor(() => expect(canvas.queryByText("Sidebar content")).toBeNull());
  await expect(canvas.getByText("Self-Engine")).toBeVisible();
  await expect(markPlace(canvas)).toEqual(place);
  await userEvent.click(expandToggle(canvas));
  await waitFor(() => expect(canvas.getByText("Sidebar content")).toBeVisible());
  await expect(canvas.getByText("Self-Engine")).toBeVisible();
  await expect(markPlace(canvas)).toEqual(place);
};

export const TheLogoDoesNotMoveWhenTogglingBesideAWideNavbar: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO, reserveWindowButtons: true },
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

/** No row of its own above them, in any state. */
const expectContainersReachTheTop = async (canvas: ReturnType<typeof within>): Promise<void> => {
  await expect(canvasRoot(canvas).querySelector(".mantine-AppShell-header")).toBeNull();
  await expect(navbarOf(canvas).getBoundingClientRect().top).toBeCloseTo(8, 0);
  await expect(paneOf(canvas, "Page content").getBoundingClientRect().top).toBeCloseTo(8, 0);
};

const expectEntriesBelowTheStrip = async (canvas: ReturnType<typeof within>): Promise<void> => {
  await expect(
    canvas.getByRole("button", { name: "Projects" }).getBoundingClientRect().top,
  ).toBeCloseTo(navbarOf(canvas).getBoundingClientRect().top + STRIP_HEIGHT, 0);
};

const expectMarkOnTheIconAxis = async (canvas: ReturnType<typeof within>): Promise<void> => {
  const icon = canvas.getByRole("button", { name: "Projects" }).querySelector("svg")!;
  await expect(centerX(canvas.getByTestId("mark"))).toBeCloseTo(centerX(icon), 0);
  await expect(centerX(canvas.getByTestId("mark"))).toBeCloseTo(centerX(navbarOf(canvas)), 0);
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
  args: { logo: LOGO, moduleSidebarCollapsed: true, reserveWindowButtons: true },
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
      centerX(canvas.getByRole("button", { name: "Projects" }).querySelector("svg")!),
      0,
    );
  },
};

/** The real mark, which grows with the font scale where the stories' fixed one would not. */
const SCALING_LOGO = { mark: <BrandMark data-testid="mark" />, name: "Self-Engine" };

const expectNameFitsTheNavbar = async (canvas: ReturnType<typeof within>): Promise<void> => {
  await document.fonts.ready;
  const navbar = navbarOf(canvas).getBoundingClientRect();
  const padding = Number.parseFloat(getComputedStyle(navbarOf(canvas)).paddingInlineEnd);
  await expect(canvas.getByText("Self-Engine").getBoundingClientRect().right).toBeLessThanOrEqual(
    navbar.right - padding + 0.5,
  );
};

/** 76 px to the logo's start from the container edge, 129 for mark and name, 10 of padding. */
export const TheMinimumWideWidthClearsTheWindowButtonsAndTheLogo: Story = {
  ...atViewport("wide"),
  ...resizable,
  args: { logo: LOGO, reserveWindowButtons: true },
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

const ringOf = (element: Element) => getComputedStyle(element).outlineStyle;

const focused = () => {
  const element = document.activeElement;
  if (element === null || element === document.body) throw new Error("nothing has the focus");
  return element;
};

/**
 * `userEvent` moves the focus by script, and Chromium shows `:focus-visible` after that. So does a
 * real click on a control that already had the keyboard's focus, which is where the owner saw it.
 */
export const TheFocusRingFollowsTheKeyboardAndNotAClick: Story = {
  ...atViewport("wide"),
  play: async ({ canvas }) => {
    const toggle = collapseToggle(canvas);
    await userEvent.click(toggle);
    await expect(toggle).toHaveFocus();
    await expect(ringOf(toggle)).toBe("none");
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(toggle).toHaveFocus();
    await expect(ringOf(toggle)).toBe("solid");
    await userEvent.click(toggle);
    await expect(ringOf(toggle)).toBe("none");
  },
};

/** The Drawer's focus trap and its focus return move the focus by script, after a pointer too. */
export const NoFocusRingAfterOpeningAndClosingTheDrawerWithThePointer: Story = {
  ...atViewport("narrow"),
  play: async ({ canvas }) => {
    const burger = burgerOf(canvas);
    await userEvent.tab();
    await expect(burger).toHaveFocus();
    await expect(ringOf(burger)).toBe("solid");
    const drawer = await openDrawer(canvas);
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));
    await expect(ringOf(focused())).toBe("none");
    const close = within(drawer).getByRole("button", { name: "Close navigation" });
    await userEvent.click(close);
    await expect(ringOf(close)).toBe("none");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(burger).toHaveFocus());
    await expect(ringOf(burger)).toBe("none");
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
