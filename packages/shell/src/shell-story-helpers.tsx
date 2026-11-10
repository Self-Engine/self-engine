// Shared by the Shell's Stories, which are split by concern. Not a story file, so the Catalog
// does not list it.

import { ProjectsIcon, SettingsIcon, TimeIcon } from "@self-engine/icons";
import { BrandMark } from "@self-engine/icons/brand-mark";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, fn, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import {
  type LeaveGuard,
  Shell,
  SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  SHELL_STANDARD_NAVBAR,
  type ShellContribution,
  type ShellProps,
  type ShellRouting,
  type ViewAddress,
  type ViewSearch,
} from "./index.ts";

export type Canvas = ReturnType<typeof within>;

/**
 * Esc as the browser delivers it. Between the listeners of a real key press the browser runs
 * microtasks, and with them React, which a scripted event does not allow. Only the story runner
 * can press a key, so in the Catalog's own page this stays scripted.
 */
export async function pressEscape() {
  const keyboard =
    import.meta.env.MODE === "test"
      ? (await import("vite-plus/test/browser")).userEvent
      : userEvent;
  await keyboard.keyboard("{Escape}");
}

/** Follows a spied platform too, because the hotkey library reads it at each press. */
export const modKey = () =>
  /mac/i.test(navigator.platform + navigator.userAgent) ? "Meta" : "Control";

const pressPaletteKey = () => userEvent.keyboard(`{${modKey()}>}k{/${modKey()}}`);

export const paletteDialog = () => screen.queryByRole("dialog", { name: "Command palette" });

/** The bindings and the palette's code load late, so an early press is lost. */
export async function openPalette(press = pressPaletteKey): Promise<HTMLElement> {
  await waitFor(
    async () => {
      await press();
      await expect(paletteDialog()).toBeVisible();
    },
    { timeout: 10_000 },
  );
  return paletteDialog()!;
}

export const paletteGone = () => waitFor(() => expect(paletteDialog()).toBeNull());

export function pretendPlatform(platform: string, userAgent: string) {
  const spies = [
    spyOn(navigator, "platform", "get").mockReturnValue(platform),
    spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent),
  ];
  return () => {
    for (const spy of spies) spy.mockRestore();
  };
}

export const onWindows = () => pretendPlatform("Win32", "Windows NT");
export const onMac = () => pretendPlatform("MacIntel", "Macintosh");

const load = async () => ({ default: () => null });
export const ENTRIES = [
  {
    id: "projects",
    name: { id: "story-Projects", message: "Projects" },
    icon: ProjectsIcon,
    color: "blue",
    views: [
      { id: "overview", title: { id: "story-Sidebar content", message: "Sidebar content" }, load },
    ],
  },
  {
    id: "time",
    name: { id: "story-Time", message: "Time" },
    icon: TimeIcon,
    color: "teal",
    views: [
      { id: "overview", title: { id: "story-Sidebar content", message: "Sidebar content" }, load },
    ],
  },
  {
    id: "third",
    name: { id: "story-Third module", message: "Third module" },
    icon: ProjectsIcon,
    color: "orange",
    views: [{ id: "overview", title: { id: "story-Overview", message: "Overview" }, load }],
  },
] satisfies readonly ShellContribution[];
export const SETTINGS: ShellContribution = {
  id: "settings",
  name: { id: "story-Settings", message: "Settings" },
  icon: SettingsIcon,
  color: "grape",
  views: [{ id: "overview", title: { id: "story-Settings", message: "Settings" }, load }],
};

/** One real window width per Layout Step, around Mantine's own breakpoints. */
export const VIEWPORTS = {
  wide: { name: "Wide", styles: { width: "1280px", height: "800px" } },
  medium: { name: "Medium", styles: { width: "1100px", height: "800px" } },
  narrow: { name: "Narrow", styles: { width: "800px", height: "800px" } },
  narrowest: { name: "Narrowest", styles: { width: "576px", height: "800px" } },
  phone: { name: "Phone", styles: { width: "390px", height: "800px" } },
};

export function atViewport(value: keyof typeof VIEWPORTS) {
  return { globals: { viewport: { value, isRotated: false } } };
}

/** An address that lives in the Story and changes at once, without a router. */
export function storyRouting(initial: ViewSearch = {}): ShellRouting & {
  readonly address: ViewAddress;
} {
  let search = initial;
  const listeners = new Set<() => void>();
  const guards = new Set<LeaveGuard>();
  const leave = async (next: ViewSearch) => {
    const addressOf = (at: ViewSearch) => ({ pathname: "/story", search: at });
    for (const guard of guards) {
      // oxlint-disable-next-line no-await-in-loop -- like the router, one guard after the other
      if (!(await guard({ current: addressOf(search), next: addressOf(next) }))) return;
    }
    search = next;
    for (const listener of listeners) listener();
  };
  const address: ViewAddress = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    search: () => search,
    writeSearch: (update) => void leave(update(search)),
    scopedWriteSearch: () => address.writeSearch,
  };
  return {
    address,
    useAddress: () => address,
    useLeaveGuard: (guard, enabled) => {
      useEffect(() => {
        if (!enabled) return undefined;
        guards.add(guard);
        return () => {
          guards.delete(guard);
        };
      }, [guard, enabled]);
    },
    Link: ({ to, search: nextSearch, onClick, ...props }) => (
      <a
        {...props}
        href={to}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (nextSearch !== undefined) {
            address.writeSearch((previous) =>
              typeof nextSearch === "function" ? nextSearch(previous) : nextSearch,
            );
          }
        }}
      />
    ),
  };
}

const routing = storyRouting();

/** What every Story file of the Shell spreads into its `meta`, next to its own `title`. */
export const shellMeta = {
  component: Shell,
  parameters: { layout: "fullscreen", viewport: { options: VIEWPORTS } },
  args: {
    activeModule: ENTRIES[1],
    activeView: { id: "overview", title: { id: "story-Time", message: "Time" }, load },
    children: <p>Page content</p>,
    contributions: ENTRIES,
    onModuleSidebarCollapsedCommit: fn(),
    onModuleSidebarWidthCommit: fn(),
    onNavbarCommit: fn(),
    routing,
    settings: SETTINGS,
  },
} satisfies Meta<ShellProps>;

export type Story = StoryObj<typeof shellMeta>;

/** The largest channel of a computed color, which tells a dark surface from a light one. */
export function brightnessOf(color: string): number {
  return Math.max(
    ...color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number),
  );
}

/** The window really has the width of its Layout Step, and the frame the story's Color Mode. */
export async function expectWindow(
  canvas: Canvas,
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

export const inDark = (story: Story): Story => ({
  ...story,
  globals: { ...story.globals, colorMode: "dark" },
});

export function navbarOf(canvas: Canvas): HTMLElement {
  return canvas.getByRole("navigation", { name: "Modules" });
}

export function canvasRoot(canvas: Canvas): HTMLElement {
  return canvas.getByRole("main").parentElement!;
}

/** The narrow step: no Navbar in the frame, and the content has the outer gap on both sides. */
export async function expectContentFillsTheFrame(
  canvas: Canvas,
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
export function widthOf(element: Element): number {
  return Math.round(element.getBoundingClientRect().width);
}

/** The 56 px Navbar has 36 px inside its padding, so the mark of the active entry is 36 × 40. */
export async function expectActiveEntryFillsTheColumn(active: HTMLElement): Promise<void> {
  await expect(Math.round(active.getBoundingClientRect().width)).toBe(36);
  await expect(Math.round(active.getBoundingClientRect().height)).toBe(40);
}

/** Resizes the frame the story runs in, which is the window for its media queries. */
export async function atFrameWidth(width: number, change: () => Promise<void>): Promise<void> {
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

/**
 * The window buttons end 76 px from the window edge, past a 56 px Navbar, so the strip has to run
 * on over the Module Sidebar. Nothing but the drag region may sit under them.
 */
export async function expectStripOverAnIconsOnlyNavbar(canvas: Canvas): Promise<void> {
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

export const centerY = (element: Element) => {
  const { top, height } = element.getBoundingClientRect();
  return top + height / 2;
};

export const appRegionOf = (element: Element) =>
  getComputedStyle(element).getPropertyValue("-webkit-app-region");

/** Holds the widths the way the app does, so a commit shows up in the next render. */
export function ResizableShell(args: ShellProps) {
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

export const resizable = { render: (args: ShellProps) => <ResizableShell {...args} /> };

export const navbarHandle = (canvas: Canvas) =>
  canvas.getByRole("separator", { name: "Resize navbar" });

export const paneOf = (canvas: Canvas, text: string) => {
  const pane = canvas.getByText(text).closest(".mantine-Splitter-pane");
  if (pane === null) throw new Error(`"${text}" is not in a pane`);
  return pane;
};

export async function expectReportedOnce(callback: unknown, value: unknown): Promise<void> {
  await expect(callback).toHaveBeenCalledTimes(1);
  await expect(callback).toHaveBeenCalledWith(value);
}

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Real pointer events with exact coordinates, which `userEvent` does not promise in a browser. */
export async function pressHandle(handle: HTMLElement) {
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

/** The real font scale, through the Catalog's toolbar global. */
export const wideAt112Percent = { globals: { ...atViewport("wide").globals, fontScale: "112.5" } };

export const LOGO = {
  mark: <svg data-testid="mark" height={28} width={28} />,
  name: "Self-Engine",
};

/** The macOS window with the logo: what most of the Stories around them need. */
export const LOGO_AND_WINDOW_BUTTONS = { logo: LOGO, reserveWindowButtons: true };

export const centerX = (element: Element) => {
  const { left, width } = element.getBoundingClientRect();
  return left + width / 2;
};

export const brandPlace = (canvas: Canvas) => {
  const mark = canvas.getByTestId("mark").getBoundingClientRect();
  const name = canvas.getByText("Self-Engine").getBoundingClientRect();
  return { markLeft: mark.left, markTop: mark.top, nameLeft: name.left };
};

export const STRIP_HEIGHT = 48;

export const dividerIn = (navbar: Element) => {
  const divider = [...navbar.children].find((child) => widthOf(child) === 1);
  if (divider === undefined) throw new Error("the Navbar has no divider");
  return divider;
};

export const dividerOf = (canvas: Canvas) => dividerIn(navbarOf(canvas));

/** The real font scale, through the Catalog's toolbar global. */
export const atSmallestFontScale = (viewport: keyof typeof VIEWPORTS) => ({
  globals: { ...atViewport(viewport).globals, fontScale: "87.5" },
});

export async function openDrawer(canvas: Canvas, burger = "Open navigation"): Promise<HTMLElement> {
  await userEvent.click(canvas.getByRole("button", { name: burger }));
  const drawer = await screen.findByRole("dialog", { name: "Module Sidebar" });
  await waitFor(() => expect(within(drawer).getByText("Sidebar content")).toBeVisible());
  return drawer;
}

export const drawerHeaderOf = (drawer: HTMLElement) => {
  const header = drawer.querySelector(".mantine-Drawer-header");
  if (header === null) throw new Error("the Drawer has no header");
  return header;
};

/** In a portal, outside the dialog, and clicking it closes the Drawer. */
export const drawerOverlay = () => {
  const overlay = document.querySelector(".mantine-Drawer-overlay");
  if (overlay === null) throw new Error("the Drawer has no overlay");
  return overlay;
};

export const drawerNavbarOf = (drawer: HTMLElement) =>
  within(drawer).getByRole("navigation", { name: "Modules" });

export const burgerOf = (canvas: Canvas) => canvas.getByRole("button", { name: "Open navigation" });

export const sidebarHandle = (canvas: Canvas) =>
  canvas.getByRole("separator", { name: "Resize module sidebar" });

export const collapseToggle = (canvas: Canvas) =>
  canvas.getByRole("button", { name: "Collapse module sidebar" });

export const expandToggle = (canvas: Canvas) =>
  canvas.getByRole("button", { name: "Expand module sidebar" });

export const queryCollapseToggle = (canvas: Canvas) =>
  canvas.queryByRole("button", { name: /(Collapse|Expand) module sidebar/ });

/** The macOS state with both collapsed: Module Sidebar closed and the Navbar icons-only. */
export const BOTH_COLLAPSED = {
  ...LOGO_AND_WINDOW_BUTTONS,
  moduleSidebarCollapsed: true,
  navbar: { collapsed: true, expandedWidth: 260 },
};

/** The icons-only Navbar ends 8 px after the window buttons, which end 76 px from the window edge. */
export const expectIconsOnlyNavbarHoldsTheWindowButtons = async (canvas: Canvas): Promise<void> => {
  await expect(navbarOf(canvas).getBoundingClientRect().right).toBeCloseTo(84, 0);
};

/** Centered on the wider icons-only Navbar, in the geometry an entry has everywhere else. */
export const expectEntriesCenteredOnTheIconsOnlyNavbar = async (canvas: Canvas): Promise<void> => {
  const navbar = navbarOf(canvas);
  for (const entry of within(navbar).getAllByRole("link")) {
    const icon = entry.querySelector("svg")!;
    // oxlint-disable-next-line no-await-in-loop -- one assertion per entry, in order
    await expect(centerX(icon)).toBeCloseTo(centerX(navbar), 0);
  }
};

export const headerOf = (canvas: Canvas) =>
  canvas.getByRole("heading", { name: "Time" }).parentElement!.parentElement!;

export const markPlace = (canvas: Canvas) => {
  const { left, top } = canvas.getByTestId("mark").getBoundingClientRect();
  return { left, top };
};

export const markStaysPutWhenToggling = async (canvas: Canvas): Promise<void> => {
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

/** No row of its own above them, in any state. */
export const expectContainersReachTheTop = async (canvas: Canvas): Promise<void> => {
  await expect(canvasRoot(canvas).querySelector(".mantine-AppShell-header")).toBeNull();
  await expect(navbarOf(canvas).getBoundingClientRect().top).toBeCloseTo(8, 0);
  await expect(paneOf(canvas, "Page content").getBoundingClientRect().top).toBeCloseTo(8, 0);
};

export const expectEntriesBelowTheStrip = async (canvas: Canvas): Promise<void> => {
  await expect(
    canvas.getByRole("link", { name: "Projects" }).getBoundingClientRect().top,
  ).toBeCloseTo(navbarOf(canvas).getBoundingClientRect().top + STRIP_HEIGHT, 0);
};

export const expectMarkOnTheIconAxis = async (canvas: Canvas): Promise<void> => {
  const icon = canvas.getByRole("link", { name: "Projects" }).querySelector("svg")!;
  await expect(centerX(canvas.getByTestId("mark"))).toBeCloseTo(centerX(icon), 0);
  await expect(centerX(canvas.getByTestId("mark"))).toBeCloseTo(centerX(navbarOf(canvas)), 0);
};

/** The real mark, which grows with the font scale where the stories' fixed one would not. */
export const SCALING_LOGO = { mark: <BrandMark data-testid="mark" />, name: "Self-Engine" };

export const expectNameFitsTheNavbar = async (canvas: Canvas): Promise<void> => {
  await document.fonts.ready;
  const navbar = navbarOf(canvas).getBoundingClientRect();
  const padding = Number.parseFloat(getComputedStyle(navbarOf(canvas)).paddingInlineEnd);
  await expect(canvas.getByText("Self-Engine").getBoundingClientRect().right).toBeLessThanOrEqual(
    navbar.right - padding + 0.5,
  );
};

/** What the user sees, and that showing a clamped width reports nothing that would overwrite it. */
export async function expectShownWithoutReport(
  canvas: Canvas,
  args: ShellProps,
  shown: { readonly navbar: number; readonly moduleSidebar: number },
): Promise<void> {
  const navbar = canvas.getByRole("navigation", { name: "Modules" });
  const pane = canvas.getByText("Sidebar content").closest(".mantine-Splitter-pane");
  await expect(Math.round(navbar.getBoundingClientRect().width)).toBe(shown.navbar);
  await expect(Math.round(pane?.getBoundingClientRect().width ?? 0)).toBe(shown.moduleSidebar);
  await expect(args.onNavbarCommit).not.toHaveBeenCalled();
  await expect(args.onModuleSidebarWidthCommit).not.toHaveBeenCalled();
}

/** Every navigation surface exposes the same destinations and current page. */
export async function expectNavigationLinks(navigation: Canvas): Promise<void> {
  await expect(navigation.getAllByRole("link")).toHaveLength(4);
  await expect(navigation.getByRole("link", { name: "Projects" })).toHaveAttribute(
    "href",
    "/projects/overview",
  );
  await expect(navigation.getByRole("link", { name: "Time", current: "page" })).toHaveAttribute(
    "href",
    "/time/overview",
  );
  await expect(navigation.getByRole("link", { name: "Settings" })).toHaveAttribute(
    "href",
    "/settings/overview",
  );
  await expect(navigation.getByRole("link", { name: "Projects" })).not.toHaveAttribute(
    "aria-current",
  );
  await expect(navigation.getByRole("link", { name: "Settings" })).not.toHaveAttribute(
    "aria-current",
  );
}

export const LONG_MODULE: ShellContribution = {
  ...ENTRIES[1]!,
  views: [
    ENTRIES[1]!.views[0],
    ...Array.from({ length: 80 }, (_, index) => ({
      id: `view-${index}`,
      title: { id: `sample-view-${index}`, message: `View ${index}` },
      load,
    })),
  ],
};
