import { useLingui } from "@lingui/react/macro";
import {
  AppShell,
  Box,
  Burger,
  Drawer,
  Group,
  NavLink,
  rem,
  ScrollArea,
  Splitter,
  Title,
  Tooltip,
  useAppShellResize,
  useMatches,
  useMantineTheme,
} from "@mantine/core";
import { clamp, type SplitterPaneSize, useDisclosure } from "@mantine/hooks";
import { type ColorSetId, roleColor } from "@self-engine/theme";
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

/** Starting values from #19, in Mantine's unscaled numbers. */
const NAVBAR_ICONS_ONLY_WIDTH = 68;
const NAVBAR_STANDARD_WIDTH = 220;
const NAVBAR_MIN_WIDE_WIDTH = 168;
const NAVBAR_MAX_WIDTH = 280;
const NAVBAR_COLLAPSE_BELOW = (NAVBAR_ICONS_ONLY_WIDTH + NAVBAR_MIN_WIDE_WIDTH) / 2;
const MODULE_SIDEBAR_MIN_WIDTH = 200;
const MODULE_SIDEBAR_MAX_WIDTH = 360;
export const SHELL_STANDARD_MODULE_SIDEBAR_WIDTH = 240;
/** The same steps as Mantine's Navbar handle. */
const KEYBOARD_STEP = 10;
const KEYBOARD_SHIFT_STEP = 50;
const GAP = 8;
const CONTENT_HEADER_HEIGHT = 48;
const BOTTOM_BAR_HEIGHT = 64;
const WINDOW_BUTTONS_STRIP_HEIGHT = 40;

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

const ENTRY_STYLES = {
  labelled: { root: ENTRY_ROOT_STYLE },
  iconsOnly: {
    root: { ...ENTRY_ROOT_STYLE, justifyContent: "center" },
    section: { marginInlineEnd: 0 },
    body: { display: "none" },
  },
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

export interface ShellProps {
  /** The modules, in Navbar order. */
  readonly entries: readonly ShellEntry[];
  /** Follows the modules: at the foot of the Navbar, last in the bottom bar. */
  readonly settingsEntry: ShellEntry;
  readonly activeEntryId: string;
  readonly onSelectEntry: (id: string) => void;
  readonly moduleSidebar: ReactNode;
  readonly pageTitle: string;
  /** The free end of the content header. */
  readonly headerEnd?: ReactNode;
  readonly channelBadge?: ReactNode;
  readonly navbar?: ShellNavbarState;
  readonly moduleSidebarWidth?: number;
  /** Called once per change, when the user releases the handle or presses a key. */
  readonly onNavbarCommit?: (navbar: ShellNavbarState) => void;
  /** Called once per change, when the user releases the handle or presses a key. */
  readonly onModuleSidebarWidthCommit?: (width: number) => void;
  /** Keeps a strip free at the top of the Navbar for the macOS window buttons. */
  readonly reserveWindowButtons?: boolean;
  /** The page. Stays mounted whichever Layout Step the window is in. */
  readonly children: ReactNode;
}

/** A stored width outside the current limits is clamped when shown, not reset. */
function shownWidthOf({ collapsed, expandedWidth }: ShellNavbarState): number {
  return collapsed
    ? NAVBAR_ICONS_ONLY_WIDTH
    : clamp(expandedWidth, NAVBAR_MIN_WIDE_WIDTH, NAVBAR_MAX_WIDTH);
}

/**
 * Where the Navbar comes to rest. A drag snaps by position. A key press only has a direction,
 * and snapping by position would pull it back every time, so it crosses the gap in one step.
 */
function settledNavbar(
  width: number,
  current: ShellNavbarState,
  dragged: boolean,
): ShellNavbarState {
  if (width >= NAVBAR_MIN_WIDE_WIDTH) return { collapsed: false, expandedWidth: Math.round(width) };
  const collapses = dragged ? width < NAVBAR_COLLAPSE_BELOW : width <= shownWidthOf(current);
  return collapses
    ? { ...current, collapsed: true }
    : { collapsed: false, expandedWidth: NAVBAR_MIN_WIDE_WIDTH };
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
  headerEnd,
  channelBadge,
  navbar = SHELL_STANDARD_NAVBAR,
  moduleSidebarWidth = SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  onNavbarCommit,
  onModuleSidebarWidthCommit,
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
  const entryAppearance = step !== "wide" || navbar.collapsed ? "iconsOnly" : "labelled";
  const navbarWidth = navbar.collapsed
    ? NAVBAR_ICONS_ONLY_WIDTH
    : { base: NAVBAR_ICONS_ONLY_WIDTH, lg: shownWidthOf(navbar) };
  // `Splitter` resolves sizes without Mantine's scale, so widths are converted here, once.
  const paneSize = (width: number): `${number}px` => `${width * theme.scale}px`;
  const shownModuleSidebarWidth = clamp(
    moduleSidebarWidth,
    MODULE_SIDEBAR_MIN_WIDTH,
    MODULE_SIDEBAR_MAX_WIDTH,
  );
  const [draggedPaneSize, setDraggedPaneSize] = useState<SplitterPaneSize | null>(null);
  const moduleSidebarDragging = useRef(false);
  const moduleSidebarPaneSize = sidebarInDrawer
    ? "0px"
    : (draggedPaneSize ?? paneSize(shownModuleSidebarWidth));

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
  const navbarResize = useAppShellResize({
    navbar: { min: NAVBAR_ICONS_ONLY_WIDTH, max: NAVBAR_MAX_WIDTH, label: t`Resize navbar` },
    onResizeEnd: ({ navbar: width }) => {
      if (width === undefined) return;
      commitNavbar(settledNavbar(width, navbar, navbarResize.activeSection === "navbar"));
    },
  });
  // Our props are the truth: Mantine would otherwise prefer the size it remembers from a drag.
  const shownNavbarWidth = shownWidthOf(navbar);
  const controlledNavbarResize = {
    ...navbarResize,
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

  return (
    <AppShell
      {...(isPhone && { footer: { height: BOTTOM_BAR_HEIGHT } })}
      mode="static"
      // `collapsed.mobile`, because without it Mantine's phone rule also matches at exactly `xs`,
      // which is the smallest Electron window.
      navbar={{ width: navbarWidth, breakpoint: "xs", collapsed: { mobile: true } }}
      padding={0}
      // Mantine prefers a resized width over the responsive ones, so only the wide step gets it.
      {...(step === "wide" && { resize: controlledNavbarResize })}
      style={ROOT_STYLE}
    >
      {!isPhone && (
        <AppShell.Navbar
          aria-label={t`Modules`}
          p="xs"
          style={{
            backgroundColor: roleColor("navSurface"),
            borderRadius: sidebarInDrawer ? RADIUS : `${RADIUS} 0 0 ${RADIUS}`,
          }}
          withBorder={!sidebarInDrawer}
        >
          {reserveWindowButtons && <Box flex="none" h={rem(WINDOW_BUTTONS_STRIP_HEIGHT)} />}
          <AppShell.Section component={ScrollArea} grow>
            {entries.map((entry) => entryLink(entry, entryAppearance))}
          </AppShell.Section>
          <AppShell.Section>{entryLink(settingsEntry, entryAppearance)}</AppShell.Section>
        </AppShell.Navbar>
      )}
      <AppShell.Main
        style={{
          minHeight: 0,
          minWidth: 0,
          paddingInlineStart: step === "narrow" ? rem(GAP) : 0,
        }}
      >
        <Splitter
          h="100%"
          attributes={{ handle: { "aria-label": t`Resize module sidebar` } }}
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
            handle: { backgroundColor: "transparent", display: sidebarInDrawer ? "none" : undefined },
            thumb: { backgroundColor: "transparent", border: "none", width: rem(GAP / 2) },
          }}
        >
          <Splitter.Pane
            defaultSize={moduleSidebarPaneSize}
            max={paneSize(MODULE_SIDEBAR_MAX_WIDTH)}
            min={paneSize(MODULE_SIDEBAR_MIN_WIDTH)}
            style={MODULE_SIDEBAR_PANE_STYLE}
          >
            {!sidebarInDrawer && (
              <ScrollArea h="100%">
                <Box p="xs">{moduleSidebar}</Box>
              </ScrollArea>
            )}
          </Splitter.Pane>
          <Splitter.Pane defaultSize={100} style={CONTENT_PANE_STYLE}>
            <Group flex="none" gap="sm" h={rem(CONTENT_HEADER_HEIGHT)} px="md" wrap="nowrap">
              {sidebarInDrawer && (
                <Burger
                  aria-label={t`Open module sidebar`}
                  onClick={toggleDrawer}
                  opened={drawerOpened}
                  size="sm"
                />
              )}
              <Group flex={1} gap="sm" miw={0} wrap="nowrap">
                <Title lineClamp={1} order={1} size="h4">
                  {pageTitle}
                </Title>
                {channelBadge}
              </Group>
              {headerEnd}
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
      <Drawer
        closeButtonProps={{ "aria-label": t`Close module sidebar` }}
        onClose={closeDrawer}
        opened={sidebarInDrawer && drawerOpened}
        size={shownModuleSidebarWidth}
        title={t`Module Sidebar`}
      >
        {moduleSidebar}
      </Drawer>
    </AppShell>
  );
}
