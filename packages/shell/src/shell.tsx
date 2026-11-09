import { useLingui } from "@lingui/react/macro";
import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Drawer,
  Group,
  NavLink,
  rem,
  ScrollArea,
  Splitter,
  Stack,
  Text,
  Title,
  Tooltip,
  useAppShellResize,
  useMatches,
  useMantineTheme,
} from "@mantine/core";
import { clamp, type SplitterPaneSize, useDisclosure } from "@mantine/hooks";
import { SidePanelIcon } from "@self-engine/icons";
import { type ColorSetId, roleColor } from "@self-engine/theme";
import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

/** Starting values from #19, in Mantine's unscaled numbers. */
const NAVBAR_ICONS_ONLY_WIDTH = 56;
const NAVBAR_STANDARD_WIDTH = 220;
/** Never narrower than this, whatever the logo needs. */
const NAVBAR_SMALLEST_WIDE_WIDTH = 168;
const NAVBAR_MAX_WIDTH = 280;
/** Mantine's `xs`, which is the Navbar's padding and the gap between the mark and the name. */
const NAVBAR_PADDING = 10;
/** The 28 px mark, the gap and "Self-Engine" in its weight, measured at the standard scale. */
const LOGO_WITH_NAME_WIDTH = 28 + NAVBAR_PADDING + 91;
/** The variables Mantine's handle writes in `static` mode, and removes again on its own. */
const NAVBAR_PREVIEW_VARIABLES = ["--app-shell-navbar-width", "--app-shell-navbar-grid-width"];
const MODULE_SIDEBAR_MIN_WIDTH = 200;
const MODULE_SIDEBAR_MAX_WIDTH = 360;
export const SHELL_STANDARD_MODULE_SIDEBAR_WIDTH = 240;
/** The same steps as Mantine's Navbar handle. */
const KEYBOARD_STEP = 10;
const KEYBOARD_SHIFT_STEP = 50;
const GAP = 8;
const CONTENT_HEADER_HEIGHT = 48;
const BOTTOM_BAR_HEIGHT = 64;
const ENTRY_HEIGHT = 40;
/** As high as the content header and level with it, so window buttons, logo and page title share a line. */
const TOP_STRIP_HEIGHT = CONTENT_HEADER_HEIGHT;
/** The strip and the frame's gap above it, measured from the window edge. */
const TOP_ROW_HEIGHT = GAP + TOP_STRIP_HEIGHT;
/**
 * Where anything beside the macOS window buttons starts, from the window edge: they end at 76 px
 * (see `titleBarOptions`). In real pixels, because the buttons do not follow Mantine's scale.
 */
const START_AFTER_WINDOW_BUTTONS_PX = 84;
const START_AFTER_WINDOW_BUTTONS = `${START_AFTER_WINDOW_BUTTONS_PX}px`;
/** The same place from inside the frame, for the content header that the buttons float over. */
const HEADER_START_AFTER_WINDOW_BUTTONS = `calc(${START_AFTER_WINDOW_BUTTONS} - ${rem(GAP)})`;
/** The Navbar's own padding, on top of the frame around the Shell. */
const LOGO_START_AT_CONTAINER_EDGE = `calc(${rem(GAP)} + var(--mantine-spacing-xs))`;

export const SHELL_STANDARD_NAVBAR: ShellNavbarState = {
  collapsed: false,
  expandedWidth: NAVBAR_STANDARD_WIDTH,
};

/** The Layout Steps, on Mantine's own breakpoints. */
const LAYOUT_STEPS = { base: "phone", xs: "narrow", md: "medium", lg: "wide" } as const;

/** The first render already knows its Layout Step, so that no other step flashes. */
const MEASURE_ON_FIRST_RENDER = { getInitialValueInEffect: false };

const RADIUS = "var(--mantine-radius-md)";

const ROOT_STYLE = {
  "--app-shell-border-color": roleColor("border"),
  backgroundColor: roleColor("chrome"),
  height: "100dvh",
  overflow: "hidden",
  padding: rem(GAP),
} as CSSProperties;

// Plain CSS that moves the window in Electron and means nothing in a browser, so the Shell needs
// no platform check. Electron cuts `no-drag` out of what `drag` claims, whatever is on top.
const WINDOW_DRAG_STYLE = { WebkitAppRegion: "drag" } as CSSProperties;
const NOT_WINDOW_DRAG_STYLE = { WebkitAppRegion: "no-drag" } as CSSProperties;

const TOP_EDGE_STYLE: CSSProperties = {
  ...WINDOW_DRAG_STYLE,
  height: rem(GAP),
  inset: "0 0 auto 0",
  position: "fixed",
};

const NAVBAR_STYLE: CSSProperties = {
  backgroundColor: roleColor("navSurface"),
  borderRadius: `${RADIUS} 0 0 ${RADIUS}`,
};

/** Without the Module Sidebar beside it, the Navbar is a container of its own. */
const NAVBAR_ALONE_STYLE: CSSProperties = { ...NAVBAR_STYLE, borderRadius: RADIUS };

const MAIN_STYLE: CSSProperties = { minHeight: 0, minWidth: 0 };

/** The gap that the Module Sidebar's handle keeps while it is there. */
const MAIN_BESIDE_NAVBAR_ALONE_STYLE: CSSProperties = {
  ...MAIN_STYLE,
  paddingInlineStart: rem(GAP),
};

const NAVBAR_TOP_STRIP_STYLE: CSSProperties = {
  // Starts where the Navbar starts, not below its padding.
  marginBlockStart: "calc(-1 * var(--mantine-spacing-xs))",
};

const LOGO_STYLE: CSSProperties = { ...WINDOW_DRAG_STYLE, pointerEvents: "none" };

// Outside the Navbar, so that neither its width nor its form can reach the logo.
const NAVIGATION_LOGO_STYLE: CSSProperties = {
  insetBlockStart: rem(GAP),
  position: "fixed",
  // Over the Navbar, under the Drawer.
  zIndex: "calc(var(--mantine-z-index-app) + 2)",
};

// Its surroundings start at the window edge, the strip at the frame, level with the content header.
const STRIP_FRAME_STYLE: CSSProperties = {
  ...WINDOW_DRAG_STYLE,
  paddingBlockStart: rem(GAP),
};

// Mantine's header stays inside the frame, and this one reaches the edges of the window. Its
// `sticky` would hold it below the frame's padding, however far the margin pulls it.
const TOP_ROW_STYLE: CSSProperties = {
  ...STRIP_FRAME_STYLE,
  backgroundColor: "transparent",
  marginBlockStart: rem(-GAP),
  marginInline: rem(-GAP),
  pointerEvents: "none",
  position: "relative",
};

// It opens over the content header, whose drag region would swallow the clicks.
const DRAWER_STYLES = { content: NOT_WINDOW_DRAG_STYLE, overlay: NOT_WINDOW_DRAG_STYLE };

const NAVIGATION_DRAWER_STYLES = {
  ...DRAWER_STYLES,
  // The navigation's surface, and only the columns below the strip scroll.
  content: {
    ...NOT_WINDOW_DRAG_STYLE,
    backgroundColor: roleColor("navSurface"),
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  // Mantine's header has a surface of its own, for the Drawer that scrolls as a whole.
  header: { backgroundColor: "transparent" },
} satisfies Record<string, CSSProperties>;

const DRAWER_NAVBAR_STYLE: CSSProperties = {
  display: "flex",
  flex: "none",
  flexDirection: "column",
  position: "relative",
  width: rem(NAVBAR_ICONS_ONLY_WIDTH),
};

const BURGER_STYLE: CSSProperties = { ...NOT_WINDOW_DRAG_STYLE, borderRadius: RADIUS };

const CONTENT_PANE_STYLE: CSSProperties = {
  backgroundColor: roleColor("canvas"),
  borderRadius: RADIUS,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const MODULE_SIDEBAR_PANE_STYLE: CSSProperties = {
  backgroundColor: roleColor("navSurface"),
  borderRadius: `0 ${RADIUS} ${RADIUS} 0`,
  display: "flex",
  flexDirection: "column",
};

// A line of its own, because Mantine's border could only run the whole height of the Navbar.
const NAVBAR_DIVIDER_STYLE: CSSProperties = {
  backgroundColor: roleColor("border"),
  bottom: 0,
  position: "absolute",
  right: 0,
  width: 1,
};

const BOTTOM_BAR_STYLE: CSSProperties = {
  backgroundColor: roleColor("navSurface"),
  borderRadius: RADIUS,
  marginTop: rem(GAP),
};

const ACTIVE_ENTRY_VARS = () => ({
  root: {
    "--nl-bg": "var(--se-module-soft)",
    "--nl-color": "var(--se-module-text)",
    "--nl-hover": "var(--se-module-soft)",
  },
  children: {},
});

const ENTRY_ROOT_STYLE: CSSProperties = { borderRadius: "var(--mantine-radius-sm)" };

/** As wide as the icons-only Navbar has room, so an icon sits on its axis at every width. */
const ICON_AXIS_SLOT_WIDTH = `calc(${rem(NAVBAR_ICONS_ONLY_WIDTH)} - 2 * var(--mantine-spacing-xs))`;

/** The mark alone in the Navbar, centered where the entries center their icons. */
const LOGO_ON_ICON_AXIS_STYLE: CSSProperties = {
  justifyContent: "center",
  width: ICON_AXIS_SLOT_WIDTH,
};

/** One geometry with and without a label, so that only the label goes. */
const NAVBAR_ENTRY_STYLES = {
  root: { ...ENTRY_ROOT_STYLE, height: rem(ENTRY_HEIGHT), padding: 0 },
  section: { flex: "none", marginInlineEnd: 0, width: ICON_AXIS_SLOT_WIDTH },
};

const ENTRY_STYLES = {
  labelled: NAVBAR_ENTRY_STYLES,
  iconsOnly: { ...NAVBAR_ENTRY_STYLES, body: { display: "none" } },
  bottomBar: {
    root: {
      ...ENTRY_ROOT_STYLE,
      flex: "none",
      flexDirection: "column",
      gap: rem(2),
      width: "auto",
    },
    section: { marginInlineEnd: 0 },
    label: { fontSize: "var(--mantine-font-size-xs)" },
  },
} as const;

export interface ShellEntry {
  readonly id: string;
  /** Already translated. */
  readonly label: string;
  readonly icon: ComponentType;
  readonly color: ColorSetId;
}

/** What the user set for the Navbar. Only the wide Layout Step shows it. */
export interface ShellNavbarState {
  readonly collapsed: boolean;
  readonly expandedWidth: number;
}

/** The app's brand. The Shell only places it: its artwork comes in from outside. */
export interface ShellLogo {
  readonly mark: ReactNode;
  /** Shown beside the mark. */
  readonly name: string;
}

export interface ShellProps {
  /** The modules, in Navbar order. */
  readonly entries: readonly ShellEntry[];
  /** Follows the modules: at the foot of the Navbar, last in the bottom bar. */
  readonly settingsEntry: ShellEntry;
  readonly activeEntryId: string;
  readonly onSelectEntry: (id: string) => void;
  readonly moduleSidebar: ReactNode;
  readonly pageTitle: string;
  /** Sits in the top strip of the navigation, in the drawer at the narrow step. None at phone width. */
  readonly logo?: ShellLogo;
  /** The free end of the content header. */
  readonly headerEnd?: ReactNode;
  readonly channelBadge?: ReactNode;
  readonly navbar?: ShellNavbarState;
  readonly moduleSidebarWidth?: number;
  /** Whether the user closed the Module Sidebar. Only the wide and medium Layout Steps show it. */
  readonly moduleSidebarCollapsed?: boolean;
  /** Called once per change, when the user releases the handle or presses a key. */
  readonly onNavbarCommit?: (navbar: ShellNavbarState) => void;
  /** Called once per change, when the user releases the handle or presses a key. */
  readonly onModuleSidebarWidthCommit?: (width: number) => void;
  /** Called once per press of the collapse button. */
  readonly onModuleSidebarCollapsedCommit?: (collapsed: boolean) => void;
  /** Keeps room for the macOS window buttons: in the navigation's top strip, in the top row beside an icons-only Navbar without Module Sidebar, and in the content header at the narrow step. */
  readonly reserveWindowButtons?: boolean;
  /** The page. Stays mounted whichever Layout Step the window is in. */
  readonly children: ReactNode;
}

/**
 * The narrowest wide Navbar, in Mantine's unscaled numbers: the logo with its name has to fit its
 * strip. The window buttons stay in real pixels, so the unscaled room for them depends on the scale.
 */
function navbarMinWideWidth(scale: number, reserveWindowButtons: boolean): number {
  const logoStart = reserveWindowButtons
    ? START_AFTER_WINDOW_BUTTONS_PX / scale - GAP
    : NAVBAR_PADDING;
  return Math.max(
    NAVBAR_SMALLEST_WIDE_WIDTH,
    Math.ceil(logoStart + LOGO_WITH_NAME_WIDTH + NAVBAR_PADDING),
  );
}

const collapseMidpointOf = (minWideWidth: number) => (NAVBAR_ICONS_ONLY_WIDTH + minWideWidth) / 2;

/** A stored width outside the current limits is clamped when shown, not reset. */
function shownWidthOf(
  { collapsed, expandedWidth }: ShellNavbarState,
  minWideWidth: number,
): number {
  return collapsed ? NAVBAR_ICONS_ONLY_WIDTH : clamp(expandedWidth, minWideWidth, NAVBAR_MAX_WIDTH);
}

/**
 * Where the Navbar comes to rest. A drag snaps by position. A key press only has a direction,
 * and snapping by position would pull it back every time, so it crosses the gap in one step.
 */
function settledNavbar(
  width: number,
  current: ShellNavbarState,
  dragged: boolean,
  minWideWidth: number,
): ShellNavbarState {
  if (width >= minWideWidth) return { collapsed: false, expandedWidth: Math.round(width) };
  const collapses = dragged
    ? width < collapseMidpointOf(minWideWidth)
    : width <= shownWidthOf(current, minWideWidth);
  return collapses
    ? { ...current, collapsed: true }
    : { collapsed: false, expandedWidth: minWideWidth };
}

/** The empty band at the top of a navigation surface, which moves the window. */
function TopStrip({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <Box flex="none" h={rem(TOP_STRIP_HEIGHT)} style={{ ...WINDOW_DRAG_STYLE, ...style }}>
      {children}
    </Box>
  );
}

interface LogoProps {
  readonly logo: ShellLogo;
  readonly markOnly?: boolean;
  readonly style: CSSProperties;
}

function Logo({ logo, markOnly = false, style }: LogoProps) {
  return (
    <Group gap="xs" h={rem(TOP_STRIP_HEIGHT)} style={{ ...LOGO_STYLE, ...style }} wrap="nowrap">
      {logo.mark}
      {!markOnly && <Text fw={600}>{logo.name}</Text>}
    </Group>
  );
}

interface EntryLinkProps {
  readonly entry: ShellEntry;
  readonly active: boolean;
  readonly appearance: keyof typeof ENTRY_STYLES;
  readonly onSelect: (id: string) => void;
}

function EntryLink({ entry, active, appearance, onSelect }: EntryLinkProps) {
  const Icon = entry.icon;
  const iconsOnly = appearance === "iconsOnly";
  return (
    <Tooltip disabled={!iconsOnly} label={entry.label} position="right">
      <NavLink
        active={active}
        aria-current={active ? "page" : undefined}
        aria-label={iconsOnly ? entry.label : undefined}
        component="button"
        data-module-color={entry.color}
        label={iconsOnly ? undefined : entry.label}
        leftSection={<Icon />}
        onClick={() => onSelect(entry.id)}
        styles={ENTRY_STYLES[appearance]}
        type="button"
        vars={ACTIVE_ENTRY_VARS}
      />
    </Tooltip>
  );
}

/** The frame of the app. Knows no router, no Settings and no platform: everything comes in as props. */
export function Shell({
  entries,
  settingsEntry,
  activeEntryId,
  onSelectEntry,
  moduleSidebar,
  pageTitle,
  logo,
  headerEnd,
  channelBadge,
  navbar = SHELL_STANDARD_NAVBAR,
  moduleSidebarWidth = SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  moduleSidebarCollapsed = false,
  onNavbarCommit,
  onModuleSidebarWidthCommit,
  onModuleSidebarCollapsedCommit,
  reserveWindowButtons = false,
  children,
}: ShellProps) {
  const { t } = useLingui();
  const theme = useMantineTheme();
  const step = useMatches<(typeof LAYOUT_STEPS)[keyof typeof LAYOUT_STEPS]>(
    LAYOUT_STEPS,
    MEASURE_ON_FIRST_RENDER,
  );
  const [drawerOpened, { close: closeDrawer, toggle: toggleDrawer }] = useDisclosure(false);

  const isPhone = step === "phone";
  const sidebarInDrawer = isPhone || step === "narrow";
  // The pane stays either way and is only empty, so that the page beside it does not remount.
  const moduleSidebarShown = !sidebarInDrawer && !moduleSidebarCollapsed;
  const navbarStandsAlone = !sidebarInDrawer && moduleSidebarCollapsed;
  // Set only during a drag, so the commit on release is still the one report of a change.
  const [draggedCollapsed, setDraggedCollapsed] = useState<boolean | null>(null);
  const navbarIconsOnly = step !== "wide" || (draggedCollapsed ?? navbar.collapsed);
  const entryAppearance = navbarIconsOnly ? "iconsOnly" : "labelled";
  const minWideWidth = navbarMinWideWidth(theme.scale, reserveWindowButtons);
  const navbarWidth = navbar.collapsed
    ? NAVBAR_ICONS_ONLY_WIDTH
    : { base: NAVBAR_ICONS_ONLY_WIDTH, lg: shownWidthOf(navbar, minWideWidth) };
  // `Splitter` resolves sizes without Mantine's scale, so widths are converted here, once.
  const paneSize = (width: number): `${number}px` => `${width * theme.scale}px`;
  const shownModuleSidebarWidth = clamp(
    moduleSidebarWidth,
    MODULE_SIDEBAR_MIN_WIDTH,
    MODULE_SIDEBAR_MAX_WIDTH,
  );
  const [draggedPaneSize, setDraggedPaneSize] = useState<SplitterPaneSize | null>(null);
  const moduleSidebarDragging = useRef(false);
  const hasTopStrip = reserveWindowButtons || logo !== undefined;
  const logoMarkOnly = navbarStandsAlone && navbarIconsOnly;
  // The window buttons are wider than the icons-only Navbar, so only there do they need a row of
  // their own. It follows the form on screen, which a drag changes before its commit.
  const hasTopRow = reserveWindowButtons && navbarStandsAlone && navbarIconsOnly;
  const hasNavigationStrip = hasTopStrip && !sidebarInDrawer && !hasTopRow;
  const topStripHeight = hasNavigationStrip ? rem(TOP_STRIP_HEIGHT) : 0;
  const moduleSidebarPaneSize = moduleSidebarShown
    ? (draggedPaneSize ?? paneSize(shownModuleSidebarWidth))
    : "0px";

  const commitModuleSidebarWidth = (width: number) => {
    if (width !== shownModuleSidebarWidth) onModuleSidebarWidthCommit?.(width);
  };
  const commitPaneSize = (size: SplitterPaneSize | undefined) => {
    commitModuleSidebarWidth(Math.round(Number.parseFloat(String(size)) / theme.scale));
  };

  const commitNavbar = (next: ShellNavbarState) => {
    if (next.collapsed !== navbar.collapsed || next.expandedWidth !== navbar.expandedWidth)
      onNavbarCommit?.(next);
  };
  const appShellRef = useRef<HTMLDivElement>(null);
  const navbarResize = useAppShellResize({
    navbar: {
      min: NAVBAR_ICONS_ONLY_WIDTH,
      max: NAVBAR_MAX_WIDTH,
      label: t`Resize navbar`,
      collapseThreshold: collapseMidpointOf(minWideWidth),
    },
    onCollapseChange: (_, collapsed) => setDraggedCollapsed(collapsed),
    // Runs right after Mantine wrote the pointer's width, and only the gap needs correcting.
    onResize: ({ navbar: width }) => {
      if (width === undefined || width >= minWideWidth) return;
      const shown = rem(
        shownWidthOf(settledNavbar(width, navbar, true, minWideWidth), minWideWidth),
      );
      for (const variable of NAVBAR_PREVIEW_VARIABLES)
        appShellRef.current?.style.setProperty(variable, shown);
    },
    onResizeEnd: ({ navbar: width }) => {
      if (width === undefined) return;
      commitNavbar(
        settledNavbar(width, navbar, navbarResize.activeSection === "navbar", minWideWidth),
      );
    },
  });
  // Our props are the truth: Mantine would otherwise prefer the size it remembers from a drag.
  const shownNavbarWidth = shownWidthOf(navbar, minWideWidth);
  const controlledNavbarResize = {
    ...navbarResize,
    // Every way out of a resize passes here: release, Escape, a key press.
    endResize: (...args: Parameters<typeof navbarResize.endResize>) => {
      setDraggedCollapsed(null);
      navbarResize.endResize(...args);
    },
    sizes: { navbar: shownNavbarWidth },
    navbar: {
      ...navbarResize.navbar,
      size: shownNavbarWidth,
      // Mantine calls this on a double-click, to go back to the configured width.
      reset: () => commitNavbar({ ...navbar, collapsed: !navbar.collapsed }),
    },
  };

  useEffect(() => {
    if (!sidebarInDrawer) closeDrawer();
  }, [sidebarInDrawer, closeDrawer]);

  const entryLink = (entry: ShellEntry, appearance: EntryLinkProps["appearance"]) => (
    <EntryLink
      active={entry.id === activeEntryId}
      appearance={appearance}
      entry={entry}
      key={entry.id}
      onSelect={onSelectEntry}
    />
  );

  const navbarColumn = (appearance: EntryLinkProps["appearance"]) => (
    <>
      <AppShell.Section component={ScrollArea} grow>
        {entries.map((entry) => entryLink(entry, appearance))}
      </AppShell.Section>
      <AppShell.Section>{entryLink(settingsEntry, appearance)}</AppShell.Section>
    </>
  );

  const drawerHeader = (
    <Drawer.Header>
      <Drawer.Title>{t`Module Sidebar`}</Drawer.Title>
      <Drawer.CloseButton aria-label={isPhone ? t`Close module sidebar` : t`Close navigation`} />
    </Drawer.Header>
  );

  return (
    <AppShell
      {...(isPhone && { footer: { height: BOTTOM_BAR_HEIGHT } })}
      {...(hasTopRow && { header: { height: TOP_ROW_HEIGHT } })}
      mode="static"
      // `collapsed.desktop` gives the narrow step's width to the content, since the Navbar is in the
      // drawer. `collapsed.mobile` does the same at the phone rule, which also matches at exactly
      // `xs`, the smallest Electron window.
      navbar={{
        width: navbarWidth,
        breakpoint: "xs",
        collapsed: { mobile: true, desktop: sidebarInDrawer },
      }}
      padding={0}
      ref={appShellRef}
      // Mantine prefers a resized width over the responsive ones, so only the wide step gets it.
      {...(step === "wide" && { resize: controlledNavbarResize })}
      style={ROOT_STYLE}
      // Starts below the strip with the divider, so nothing but the drag region is up there.
      styles={{ resizeHandle: { ...NOT_WINDOW_DRAG_STYLE, top: topStripHeight } }}
    >
      <Box aria-hidden style={TOP_EDGE_STYLE} />
      {hasTopRow && (
        <AppShell.Header aria-hidden style={TOP_ROW_STYLE} withBorder={false}>
          <TopStrip />
        </AppShell.Header>
      )}
      {!sidebarInDrawer && (
        <AppShell.Navbar
          aria-label={t`Modules`}
          p="xs"
          style={navbarStandsAlone ? NAVBAR_ALONE_STYLE : NAVBAR_STYLE}
          withBorder={false}
        >
          {hasNavigationStrip && <TopStrip style={NAVBAR_TOP_STRIP_STYLE} />}
          {moduleSidebarShown && (
            <Box aria-hidden style={{ ...NAVBAR_DIVIDER_STYLE, top: topStripHeight }} />
          )}
          {navbarColumn(entryAppearance)}
        </AppShell.Navbar>
      )}
      {logo && !sidebarInDrawer && (
        <Logo
          logo={logo}
          markOnly={logoMarkOnly}
          style={{
            ...NAVIGATION_LOGO_STYLE,
            ...(logoMarkOnly && !reserveWindowButtons && LOGO_ON_ICON_AXIS_STYLE),
            insetInlineStart: reserveWindowButtons
              ? START_AFTER_WINDOW_BUTTONS
              : LOGO_START_AT_CONTAINER_EDGE,
          }}
        />
      )}
      <AppShell.Main style={navbarStandsAlone ? MAIN_BESIDE_NAVBAR_ALONE_STYLE : MAIN_STYLE}>
        <Splitter
          h="100%"
          attributes={{
            handle: {
              "aria-label": t`Resize module sidebar`,
              // A pointer drags by its own events, so only the keyboard needs the focus.
              onMouseDown: (event: MouseEvent) => event.preventDefault(),
            },
          }}
          // Below, because Mantine's reset restores the ratio of the panes, not the standard width.
          resetOnDoubleClick={false}
          handleIcon={null}
          lineSize={GAP}
          onDoubleClick={(event) => {
            const target = event.target as Element;
            if (target.parentElement === event.currentTarget && target.role === "separator")
              commitModuleSidebarWidth(SHELL_STANDARD_MODULE_SIDEBAR_WIDTH);
          }}
          onResizeEnd={(_, sizes) => {
            moduleSidebarDragging.current = false;
            setDraggedPaneSize(null);
            commitPaneSize(sizes[0]);
          }}
          onResizeStart={() => {
            moduleSidebarDragging.current = true;
          }}
          // A key press reaches only this callback, a drag ends in `onResizeEnd`.
          onSizeChange={(sizes) => {
            if (moduleSidebarDragging.current) setDraggedPaneSize(sizes[0] ?? null);
            else commitPaneSize(sizes[0]);
          }}
          shiftStep={paneSize(KEYBOARD_SHIFT_STEP)}
          sizes={[moduleSidebarPaneSize, 100]}
          step={paneSize(KEYBOARD_STEP)}
          styles={{
            // The gap is the handle. Its thumb stays invisible and only carries Mantine's focus ring.
            handle: {
              backgroundColor: "transparent",
              display: moduleSidebarShown ? undefined : "none",
            },
            thumb: { backgroundColor: "transparent", border: "none", width: rem(GAP / 2) },
          }}
        >
          <Splitter.Pane
            defaultSize={moduleSidebarPaneSize}
            max={paneSize(MODULE_SIDEBAR_MAX_WIDTH)}
            min={paneSize(MODULE_SIDEBAR_MIN_WIDTH)}
            style={MODULE_SIDEBAR_PANE_STYLE}
          >
            {moduleSidebarShown && (
              <>
                {hasTopStrip && <TopStrip />}
                <ScrollArea flex={1} mih={0}>
                  <Box p="xs">{moduleSidebar}</Box>
                </ScrollArea>
              </>
            )}
          </Splitter.Pane>
          <Splitter.Pane defaultSize={100} style={CONTENT_PANE_STYLE}>
            <Group
              flex="none"
              gap="sm"
              h={rem(CONTENT_HEADER_HEIGHT)}
              pe="md"
              ps={
                step === "narrow" && reserveWindowButtons ? HEADER_START_AFTER_WINDOW_BUTTONS : "md"
              }
              style={WINDOW_DRAG_STYLE}
              wrap="nowrap"
            >
              {sidebarInDrawer ? (
                <Burger
                  aria-label={isPhone ? t`Open module sidebar` : t`Open navigation`}
                  onClick={toggleDrawer}
                  opened={drawerOpened}
                  size="sm"
                  style={BURGER_STYLE}
                />
              ) : (
                <ActionIcon
                  aria-label={
                    moduleSidebarCollapsed ? t`Expand module sidebar` : t`Collapse module sidebar`
                  }
                  color="gray"
                  onClick={() => onModuleSidebarCollapsedCommit?.(!moduleSidebarCollapsed)}
                  style={NOT_WINDOW_DRAG_STYLE}
                  variant="subtle"
                >
                  <SidePanelIcon />
                </ActionIcon>
              )}
              <Group flex={1} gap="sm" miw={0} wrap="nowrap">
                <Title lineClamp={1} order={1} size="h4">
                  {pageTitle}
                </Title>
                {channelBadge && <Box style={NOT_WINDOW_DRAG_STYLE}>{channelBadge}</Box>}
              </Group>
              {headerEnd && <Box style={NOT_WINDOW_DRAG_STYLE}>{headerEnd}</Box>}
            </Group>
            <ScrollArea flex={1} mih={0}>
              <Box p="md">{children}</Box>
            </ScrollArea>
          </Splitter.Pane>
        </Splitter>
      </AppShell.Main>
      {isPhone && (
        <AppShell.Footer style={BOTTOM_BAR_STYLE} withBorder={false}>
          <ScrollArea h="100%" scrollbars="x" type="never">
            <Group aria-label={t`Modules`} component="nav" gap="xs" p={4} wrap="nowrap">
              {[...entries, settingsEntry].map((entry) => entryLink(entry, "bottomBar"))}
            </Group>
          </ScrollArea>
        </AppShell.Footer>
      )}
      <Drawer.Root
        onClose={closeDrawer}
        opened={sidebarInDrawer && drawerOpened}
        size={
          isPhone
            ? shownModuleSidebarWidth
            : NAVBAR_ICONS_ONLY_WIDTH + SHELL_STANDARD_MODULE_SIDEBAR_WIDTH
        }
        styles={isPhone ? DRAWER_STYLES : NAVIGATION_DRAWER_STYLES}
      >
        <Drawer.Overlay />
        <Drawer.Content>
          {isPhone ? (
            <>
              {drawerHeader}
              <Drawer.Body>{moduleSidebar}</Drawer.Body>
            </>
          ) : (
            <>
              {hasTopStrip && (
                <Box style={STRIP_FRAME_STYLE}>
                  <TopStrip>
                    {logo && (
                      <Logo
                        logo={logo}
                        style={{
                          marginInlineStart: reserveWindowButtons
                            ? START_AFTER_WINDOW_BUTTONS
                            : "var(--mantine-spacing-xs)",
                        }}
                      />
                    )}
                  </TopStrip>
                </Box>
              )}
              <Group align="stretch" flex={1} gap={0} mih={0} wrap="nowrap">
                <Box aria-label={t`Modules`} component="nav" p="xs" style={DRAWER_NAVBAR_STYLE}>
                  <Box aria-hidden style={{ ...NAVBAR_DIVIDER_STYLE, top: 0 }} />
                  {navbarColumn("iconsOnly")}
                </Box>
                <Stack flex={1} gap={0} miw={0}>
                  {drawerHeader}
                  <ScrollArea flex={1} mih={0}>
                    <Drawer.Body pt={0}>{moduleSidebar}</Drawer.Body>
                  </ScrollArea>
                </Stack>
              </Group>
            </>
          )}
        </Drawer.Content>
      </Drawer.Root>
    </AppShell>
  );
}
