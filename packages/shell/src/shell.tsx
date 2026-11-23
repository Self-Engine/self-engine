import type { DataAccess } from "@self-engine/data-client/react";
import {
  SHELL_START_AFTER_WINDOW_BUTTONS_PX,
  SHELL_TOP_STRIP_HEIGHT,
  SHELL_WINDOW_BUTTON_STRIP_HEIGHT,
  type LayoutStep,
} from "./geometry.ts";
import { CommandPalette } from "./command-palette.tsx";
import {
  CommandPaletteProvider,
  useCommandPaletteOpen,
  useOpenCommandPalette,
} from "./command-palette-state.tsx";
import { viewPath, type EditDrawerProps } from "./contributions.ts";
import { EditDrawerTitleContext } from "./edit-drawer-title.ts";
import { selectEditId, useEditDrawerExits } from "./edit-drawer-exits.tsx";
import { FrameContent, useEscapeExit } from "./frame-exits.tsx";
import { LazyContribution, lazyComponents } from "./lazy-contribution.tsx";
import { indicatorForm, type IndicatorForm } from "./module-indicator-form.ts";
import { IndicatorPanelsProvider, useIndicatorPanels } from "./indicator-panels.tsx";
import { ModuleIndicators } from "./module-indicators.tsx";
import { useCloseOverlayOnPick, useViewSearch, useWriteViewSearch } from "./routing.tsx";
import { ACTIVE_ENTRY_VARS } from "./navigation-style.ts";
import type { CommandScope } from "./palette-entries.ts";
import { PrimaryAction } from "./primary-action.tsx";
import { PALETTE_SHORTCUT, shellCommands } from "./shell-commands.ts";
import { ShortcutHint, Shortcuts } from "./shortcuts.tsx";
import { StartOnceProvider } from "./start-command.tsx";
import { useLingui } from "@lingui/react/macro";
import type { ShellContribution, ShellView } from "./contributions.ts";
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
  Title,
  Tooltip,
  useMatches,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { SearchIcon, SidePanelIcon } from "@self-engine/icons";
import { type ColorSetName, roleColor } from "@self-engine/theme";
import {
  NOT_WINDOW_DRAG_STYLE,
  NOTICE_CLEARANCE_VARIABLE,
  WINDOW_DRAG_STYLE,
} from "@self-engine/ui";
import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useState } from "react";
import {
  GAP,
  ICON_COLUMN_WIDTH,
  LOGO_START_ON_ICON_AXIS,
  NAVBAR_ICONS_ONLY_WIDTH,
  LOGO_MARK_WIDTH,
  NAVBAR_LIMITS,
  SHELL_STANDARD_NAVBAR,
  type ShellNavbarState,
} from "./navbar-geometry.ts";
import {
  SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  useModuleSidebarResize,
} from "./use-module-sidebar-resize.ts";
import {
  NavigationOverlayContext,
  ShellRoutingContext,
  type ShellRouting,
  useShellRouting,
} from "./routing.tsx";
import { useNavbarResize } from "./use-navbar-resize.ts";

const BOTTOM_BAR_HEIGHT = 64;
const ENTRY_HEIGHT = 40;
const START_AFTER_WINDOW_BUTTONS = `${SHELL_START_AFTER_WINDOW_BUTTONS_PX}px`;
/** The Layout Steps, on Mantine's own breakpoints. */
const LAYOUT_STEPS = { base: "phone", xs: "narrow", md: "medium", lg: "wide" } as const;

/** The first render already knows its Layout Step, so that no other step flashes. */
const MEASURE_ON_FIRST_RENDER = { getInitialValueInEffect: false };

function useLayoutStep() {
  return useMatches<LayoutStep>(LAYOUT_STEPS, MEASURE_ON_FIRST_RENDER);
}

const RADIUS = "var(--mantine-radius-md)";
const CONTAINER_EDGE_COLOR = roleColor("border");
const CONTAINER_OUTLINE = `inset 0 0 0 1px ${CONTAINER_EDGE_COLOR}`;

const ROOT_STYLE = {
  "--app-shell-border-color": roleColor("border"),
  backgroundColor: roleColor("chrome"),
  height: "100dvh",
  overflow: "hidden",
} as CSSProperties;

/** Spans the window above everything else and moves it. Whatever is clickable in it opts out. */
const HEADER_STYLE: CSSProperties = { ...WINDOW_DRAG_STYLE, backgroundColor: "transparent" };

/** The Navbar lies flat on the chrome, below the header. */
const NAVBAR_STYLE: CSSProperties = { backgroundColor: "transparent" };

/** The sheet keeps a gap to the window edge wherever the Navbar does not stand beside it. */
const MAIN_STYLE: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  paddingBlockEnd: rem(GAP),
  paddingInlineEnd: rem(GAP),
};

const MAIN_WITHOUT_NAVBAR_STYLE: CSSProperties = { ...MAIN_STYLE, paddingInlineStart: rem(GAP) };

const LOGO_STYLE: CSSProperties = { ...WINDOW_DRAG_STYLE, pointerEvents: "none" };

/**
 * The part of the header above the Navbar, which follows its width while it is dragged. The mark
 * sits on the icon axis.
 */
const LOGO_PLACE_STYLE: CSSProperties = {
  flex: "none",
  paddingInlineStart: rem(LOGO_START_ON_ICON_AXIS),
  width: "var(--app-shell-navbar-width)",
};

/**
 * With window buttons the mark starts after them, and the place is never narrower than buttons and
 * mark together, which an icons-only Navbar is.
 */
const LOGO_PLACE_AFTER_WINDOW_BUTTONS_STYLE: CSSProperties = {
  flex: "none",
  paddingInlineStart: START_AFTER_WINDOW_BUTTONS,
  width: `max(var(--app-shell-navbar-width), calc(${START_AFTER_WINDOW_BUTTONS} + ${rem(LOGO_MARK_WIDTH)}))`,
};

// It opens over the header, whose drag region would swallow the clicks.
const DRAWER_STYLES = { content: NOT_WINDOW_DRAG_STYLE, overlay: NOT_WINDOW_DRAG_STYLE };

// Only what is below the strip scrolls, or the title would slide back under the window buttons.
const DRAWER_BELOW_STRIP_SCROLLS_STYLE: CSSProperties = {
  ...NOT_WINDOW_DRAG_STYLE,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const PHONE_DRAWER_WITH_STRIP_STYLES = {
  ...DRAWER_STYLES,
  content: DRAWER_BELOW_STRIP_SCROLLS_STYLE,
};

// The body fills the frame, so a module can pin its buttons to the bottom. Taller content scrolls
// the frame, below Mantine's sticky header.
const EDIT_DRAWER_STYLES = {
  ...DRAWER_STYLES,
  content: { ...NOT_WINDOW_DRAG_STYLE, display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1, flexDirection: "column" },
} satisfies Record<string, CSSProperties>;

const FLOATING_EDIT_DRAWER = { size: 460, offset: GAP, radius: "lg" } as const;
const PHONE_EDIT_DRAWER = { size: "100%", offset: 0, radius: 0 } as const;

/**
 * Notices start top center at the same line at every step and whether an Edit Drawer is open or
 * not, so a notice never jumps (#230, D267). The floating drawer's title and close button end above
 * that line, its first field starts below it.
 */
const NOTICE_CLEARANCE = `:root{${NOTICE_CLEARANCE_VARIABLE}:${rem(GAP + SHELL_TOP_STRIP_HEIGHT + GAP)}}`;

const NAVIGATION_DRAWER_STYLES = {
  ...DRAWER_STYLES,
  content: { ...DRAWER_BELOW_STRIP_SCROLLS_STYLE, backgroundColor: roleColor("navSurface") },
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

/** One sheet holds the Module Sidebar and the content, below the header and beside the Navbar. */
const SHEET_STYLE: CSSProperties = {
  boxShadow: CONTAINER_OUTLINE,
  backgroundColor: roleColor("canvas"),
  borderRadius: RADIUS,
  height: "100%",
  overflow: "hidden",
};

const CONTENT_PANE_STYLE: CSSProperties = {
  backgroundColor: roleColor("canvas"),
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const MODULE_SIDEBAR_PANE_STYLE: CSSProperties = {
  boxShadow: `inset -1px 0 ${CONTAINER_EDGE_COLOR}`,
  backgroundColor: roleColor("navSurface"),
  display: "flex",
  flexDirection: "column",
};

// The line between the drawer's Navbar and its Module Sidebar.
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
  marginBlockEnd: rem(GAP),
  marginInline: rem(GAP),
};

const ENTRY_ROOT_STYLE: CSSProperties = { borderRadius: "var(--mantine-radius-sm)" };

/** One geometry with and without a label, so that only the label goes. */
const NAVBAR_ENTRY_STYLES = {
  root: { ...ENTRY_ROOT_STYLE, height: rem(ENTRY_HEIGHT), padding: 0 },
  // As wide as the icons-only Navbar has room, so an icon sits on its axis at every width. A
  // minimum, because the same style reaches the shortcut in the right section.
  section: { flex: "none", marginInlineEnd: 0, minWidth: rem(ICON_COLUMN_WIDTH) },
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

interface NavigationEntry {
  readonly id: string;
  readonly to: string;
  /** Already translated. */
  readonly label: string;
  readonly icon: ShellContribution["icon"];
  readonly color: ColorSetName;
}

/** The app's brand. The Shell only places it: its artwork comes in from outside. */
export interface ShellLogo {
  readonly mark: ReactNode;
  /** Names the mark for assistive technology; it is not shown. */
  readonly name: string;
}

interface ShellFrameProps {
  /** The modules, in Navbar order. */
  readonly entries: readonly NavigationEntry[];
  /** Follows the modules: at the foot of the Navbar, last in the bottom bar. */
  readonly settingsEntry: NavigationEntry;
  readonly activeEntryId: string;
  readonly routing: ShellRouting;
  readonly moduleSidebar: ReactNode;
  readonly editDrawer?: ReactNode;
  /** In a portal. Inside the routing, because a row starts a Command or goes to a View. */
  readonly commandPalette?: ReactNode;
  /** Renders nothing. Inside the routing, because a shortcut starts a Command on this page. */
  readonly shortcuts?: ReactNode;
  readonly pageTitle: string;
  readonly activeColor: ColorSetName | undefined;
  /** The mark alone, always top left: in the header above the Navbar, before the Burger at the drawer steps, and in the drawer's strip. */
  readonly logo?: ShellLogo;
  /** The modules whose Module Indicators end the header, in the order of the module list. */
  readonly indicatorModules?: readonly ShellContribution[];
  readonly channelBadge?: ReactNode;
  readonly navbar?: ShellNavbarState;
  readonly moduleSidebarWidth?: number;
  /** Whether the user closed the Module Sidebar. Only the wide and medium Layout Steps show it. */
  readonly moduleSidebarCollapsed?: boolean;
  /** Called once per change, when the user releases the handle, presses a key or double-clicks it. */
  readonly onNavbarCommit?: (navbar: ShellNavbarState) => void;
  /** Called once per change, when the user releases the handle, presses a key or double-clicks it. */
  readonly onModuleSidebarWidthCommit?: (width: number) => void;
  /** Called once per press of the collapse button. */
  readonly onModuleSidebarCollapsedCommit?: (collapsed: boolean) => void;
  /** Keeps room for the macOS window buttons at the start of the header and at the top of the drawer. */
  readonly reserveWindowButtons?: boolean;
  /** The page. Stays mounted whichever Layout Step the window is in. */
  readonly children: ReactNode;
}

/** The band at the top of a navigation surface, which moves the window. It can hold the logo. */
function TopStrip({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <Box
      flex="none"
      h={rem(SHELL_WINDOW_BUTTON_STRIP_HEIGHT)}
      style={{ ...WINDOW_DRAG_STYLE, ...style }}
    >
      {children}
    </Box>
  );
}

interface LogoProps {
  readonly logo: ShellLogo;
  readonly style?: CSSProperties;
}

/** The mark alone, named by the app's name. */
function Logo({ logo, style }: LogoProps) {
  return (
    <Group
      aria-label={logo.name}
      h={rem(SHELL_WINDOW_BUTTON_STRIP_HEIGHT)}
      role="img"
      style={{ ...LOGO_STYLE, ...style }}
      wrap="nowrap"
    >
      {logo.mark}
    </Group>
  );
}

interface EntryLinkProps {
  readonly entry: NavigationEntry;
  readonly active: boolean;
  readonly appearance: keyof typeof ENTRY_STYLES;
}

function EntryLink({ entry, active, appearance }: EntryLinkProps) {
  const { Link } = useShellRouting();
  const Icon = entry.icon;
  const iconsOnly = appearance === "iconsOnly";
  return (
    <Tooltip disabled={!iconsOnly} label={entry.label} position="right">
      <NavLink
        active={active}
        aria-current={active ? "page" : undefined}
        aria-label={iconsOnly ? entry.label : undefined}
        component={Link}
        data-color-set={entry.color}
        label={iconsOnly ? undefined : entry.label}
        leftSection={<Icon size={iconsOnly ? "xl" : appearance === "labelled" ? "lg" : "md"} />}
        to={entry.to}
        styles={ENTRY_STYLES[appearance]}
        vars={ACTIVE_ENTRY_VARS}
      />
    </Tooltip>
  );
}

/** Opens the Command Palette for whoever does not know the shortcut or has no keyboard at hand. */
function CommandPaletteEntry({ appearance }: Pick<EntryLinkProps, "appearance">) {
  const { t } = useLingui();
  const open = useOpenCommandPalette();
  const label = t`Search`;
  const iconsOnly = appearance === "iconsOnly";
  return (
    <Tooltip disabled={!iconsOnly} label={label} position="right">
      <NavLink
        aria-haspopup="dialog"
        // Also while the label is shown, so that the shortcut beside it is not part of the name.
        aria-label={label}
        component="button"
        label={iconsOnly ? undefined : label}
        leftSection={<SearchIcon />}
        onClick={open}
        rightSection={
          appearance === "labelled" ? (
            <Box me="xs">
              <ShortcutHint shortcut={PALETTE_SHORTCUT} />
            </Box>
          ) : undefined
        }
        styles={ENTRY_STYLES[appearance]}
      />
    </Tooltip>
  );
}

/** The entries and what happens to them, wherever the navigation is shown. */
type ShellNavigation = Pick<ShellFrameProps, "entries" | "settingsEntry" | "activeEntryId">;

function entryLink(
  { activeEntryId }: ShellNavigation,
  entry: NavigationEntry,
  appearance: EntryLinkProps["appearance"],
) {
  return (
    <EntryLink
      active={entry.id === activeEntryId}
      appearance={appearance}
      entry={entry}
      key={entry.id}
    />
  );
}

interface NavbarColumnProps {
  readonly navigation: ShellNavigation;
  readonly appearance: EntryLinkProps["appearance"];
}

function NavbarColumn({ navigation, appearance }: NavbarColumnProps) {
  return (
    <>
      <AppShell.Section component={ScrollArea} grow>
        {navigation.entries.map((entry) => entryLink(navigation, entry, appearance))}
      </AppShell.Section>
      <AppShell.Section>
        <CommandPaletteEntry appearance={appearance} />
        {entryLink(navigation, navigation.settingsEntry, appearance)}
      </AppShell.Section>
    </>
  );
}

/** Props the Shell hands on as they came in, given or not. */
type PassedOn<Name extends keyof ShellFrameProps> = {
  readonly [Key in Name]-?: ShellFrameProps[Key] | undefined;
};

interface ShellHeaderProps extends PassedOn<
  | "pageTitle"
  | "indicatorModules"
  | "channelBadge"
  | "logo"
  | "moduleSidebarCollapsed"
  | "onModuleSidebarCollapsedCommit"
> {
  readonly reserveWindowButtons: boolean;
  readonly isPhone: boolean;
  readonly indicatorForm: IndicatorForm;
  readonly navigationInDrawer: boolean;
  readonly drawerOpened: boolean;
  readonly onToggleDrawer: () => void;
}

/** Beside the Navbar the part above it starts the header; at the drawer steps the Burger does. */
function headerStart(navigationInDrawer: boolean, reserveWindowButtons: boolean): string | number {
  if (!navigationInDrawer) return 0;
  return reserveWindowButtons ? START_AFTER_WINDOW_BUTTONS : "var(--mantine-spacing-md)";
}

/**
 * Spans the window: the logo above the Navbar, then what belongs to the page, then the Module
 * Indicators. It holds the window buttons and moves the window.
 */
function ShellHeader({
  pageTitle,
  indicatorModules,
  channelBadge,
  logo,
  moduleSidebarCollapsed,
  onModuleSidebarCollapsedCommit,
  reserveWindowButtons,
  isPhone,
  indicatorForm: form,
  navigationInDrawer,
  drawerOpened,
  onToggleDrawer,
}: ShellHeaderProps) {
  const { t } = useLingui();
  return (
    <AppShell.Header style={HEADER_STYLE} withBorder={false}>
      <Group
        gap="sm"
        h="100%"
        pe="md"
        // Real pixels for the window buttons, which a style prop would turn into rem and scale.
        style={{ paddingInlineStart: headerStart(navigationInDrawer, reserveWindowButtons) }}
        wrap="nowrap"
      >
        {!navigationInDrawer && (
          <Box
            style={reserveWindowButtons ? LOGO_PLACE_AFTER_WINDOW_BUTTONS_STYLE : LOGO_PLACE_STYLE}
          >
            {logo && <Logo logo={logo} />}
          </Box>
        )}
        {navigationInDrawer && logo && <Logo logo={logo} />}
        {navigationInDrawer ? (
          <Burger
            aria-label={isPhone ? t`Open module sidebar` : t`Open navigation`}
            onClick={onToggleDrawer}
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
        {indicatorModules && (
          <ModuleIndicators form={form} modules={indicatorModules} panelAsSheet={isPhone} />
        )}
      </Group>
    </AppShell.Header>
  );
}

interface DrawerTopStripProps {
  readonly logo?: ShellLogo | undefined;
  readonly reserveWindowButtons: boolean;
}

/** Level with the header, so the native buttons have nothing else under them. */
function DrawerTopStrip({ logo, reserveWindowButtons }: DrawerTopStripProps) {
  return (
    <Box style={WINDOW_DRAG_STYLE}>
      <TopStrip>
        {logo && (
          <Logo
            logo={logo}
            // Where the header has it, so the mark does not move when the drawer opens over it.
            style={{
              marginInlineStart: reserveWindowButtons
                ? START_AFTER_WINDOW_BUTTONS
                : "var(--mantine-spacing-md)",
            }}
          />
        )}
      </TopStrip>
    </Box>
  );
}

interface NavigationDrawerProps extends PassedOn<"logo" | "moduleSidebar"> {
  readonly navigation: ShellNavigation;
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly isPhone: boolean;
  readonly hasTopStrip: boolean;
  readonly reserveWindowButtons: boolean;
  readonly moduleSidebarWidth: number;
}

/** The narrow step's way to the whole navigation, and the phone's to the Module Sidebar. */
function NavigationDrawer({
  navigation,
  opened,
  onClose,
  isPhone,
  hasTopStrip,
  reserveWindowButtons,
  moduleSidebarWidth,
  logo,
  moduleSidebar,
}: NavigationDrawerProps) {
  const { t } = useLingui();
  const paletteOpen = useCommandPaletteOpen();
  const header = (
    <Drawer.Header>
      <Drawer.Title>{t`Module Sidebar`}</Drawer.Title>
      <Drawer.CloseButton aria-label={isPhone ? t`Close module sidebar` : t`Close navigation`} />
    </Drawer.Header>
  );
  const scrollingBody = (
    <ScrollArea flex={1} mih={0}>
      <Drawer.Body pt={0}>{moduleSidebar}</Drawer.Body>
    </ScrollArea>
  );
  const phoneStyles = reserveWindowButtons ? PHONE_DRAWER_WITH_STRIP_STYLES : DRAWER_STYLES;
  const phoneContent = reserveWindowButtons ? (
    <>
      <DrawerTopStrip reserveWindowButtons />
      {header}
      {scrollingBody}
    </>
  ) : (
    <>
      {header}
      <Drawer.Body>{moduleSidebar}</Drawer.Body>
    </>
  );
  return (
    <Drawer.Root
      // One Esc would reach both, see the Edit Drawer below.
      closeOnEscape={!paletteOpen}
      onClose={onClose}
      opened={opened}
      size={
        isPhone ? moduleSidebarWidth : NAVBAR_ICONS_ONLY_WIDTH + SHELL_STANDARD_MODULE_SIDEBAR_WIDTH
      }
      styles={isPhone ? phoneStyles : NAVIGATION_DRAWER_STYLES}
    >
      <Drawer.Overlay />
      <Drawer.Content>
        <NavigationOverlayContext value={onClose}>
          {isPhone ? (
            phoneContent
          ) : (
            <>
              {hasTopStrip && (
                <DrawerTopStrip logo={logo} reserveWindowButtons={reserveWindowButtons} />
              )}
              <Group align="stretch" flex={1} gap={0} mih={0} wrap="nowrap">
                <Box aria-label={t`Modules`} component="nav" p="xs" style={DRAWER_NAVBAR_STYLE}>
                  <Box aria-hidden style={{ ...NAVBAR_DIVIDER_STYLE, top: 0 }} />
                  <NavbarColumn appearance="iconsOnly" navigation={navigation} />
                </Box>
                <Stack flex={1} gap={0} miw={0}>
                  {header}
                  {scrollingBody}
                </Stack>
              </Group>
            </>
          )}
        </NavigationOverlayContext>
      </Drawer.Content>
    </Drawer.Root>
  );
}

/**
 * The frame of the app. Knows no router and no Settings: everything comes in as props. It checks
 * for no platform either, but it does carry the geometry of the macOS window buttons, which
 * `reserveWindowButtons` switches on.
 */
function ShellFrame({
  entries,
  settingsEntry,
  activeEntryId,
  routing,
  moduleSidebar,
  editDrawer,
  commandPalette,
  shortcuts,
  pageTitle,
  activeColor,
  logo,
  indicatorModules,
  channelBadge,
  navbar = SHELL_STANDARD_NAVBAR,
  moduleSidebarWidth = SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  moduleSidebarCollapsed = false,
  onNavbarCommit,
  onModuleSidebarWidthCommit,
  onModuleSidebarCollapsedCommit,
  reserveWindowButtons = false,
  children,
}: ShellFrameProps) {
  const { t } = useLingui();
  const theme = useMantineTheme();
  const step = useLayoutStep();
  const [drawerOpened, { close: closeDrawer, toggle: toggleDrawer }] = useDisclosure(false);
  const navigation = { entries, settingsEntry, activeEntryId };

  const isPhone = step === "phone";
  const navigationInDrawer = isPhone || step === "narrow";
  // The pane stays either way and is only empty, so that the page beside it does not remount.
  const moduleSidebarShown = !navigationInDrawer && !moduleSidebarCollapsed;
  const limits = NAVBAR_LIMITS;
  const navbarResize = useNavbarResize({
    navbar,
    limits,
    label: t`Resize navbar`,
    onCommit: onNavbarCommit,
  });
  const moduleSidebarResize = useModuleSidebarResize({
    width: moduleSidebarWidth,
    shown: moduleSidebarShown,
    scale: theme.scale,
    onCommit: onModuleSidebarWidthCommit,
  });
  // The form on screen, which a drag changes before its commit.
  const navbarIconsOnly = step !== "wide" || navbarResize.collapsed;
  const hasTopStrip = reserveWindowButtons || logo !== undefined;

  useEffect(() => {
    if (!navigationInDrawer) closeDrawer();
  }, [navigationInDrawer, closeDrawer]);

  return (
    <ShellRoutingContext value={routing}>
      <style>{NOTICE_CLEARANCE}</style>
      <AppShell
        data-layout-step={step}
        {...(isPhone && { footer: { height: BOTTOM_BAR_HEIGHT } })}
        header={{ height: rem(SHELL_TOP_STRIP_HEIGHT) }}
        mode="static"
        // `collapsed.desktop` gives the narrow step's width to the content, since the Navbar is in the
        // drawer. `collapsed.mobile` does the same at the phone rule, which also matches at exactly
        // `xs`, the smallest Electron window.
        navbar={{
          width: { base: limits.iconsOnlyWidth, lg: navbarResize.shownWidth },
          breakpoint: "xs",
          collapsed: { mobile: true, desktop: navigationInDrawer },
        }}
        padding={0}
        ref={navbarResize.appShellRef}
        // Mantine prefers a resized width over the responsive ones, so only the wide step gets it.
        {...(step === "wide" && { resize: navbarResize.resize })}
        style={ROOT_STYLE}
        styles={{ resizeHandle: NOT_WINDOW_DRAG_STYLE }}
      >
        <ShellHeader
          channelBadge={channelBadge}
          drawerOpened={drawerOpened}
          indicatorForm={indicatorForm(step)}
          indicatorModules={indicatorModules}
          isPhone={isPhone}
          logo={logo}
          moduleSidebarCollapsed={moduleSidebarCollapsed}
          navigationInDrawer={navigationInDrawer}
          onModuleSidebarCollapsedCommit={onModuleSidebarCollapsedCommit}
          onToggleDrawer={toggleDrawer}
          pageTitle={pageTitle}
          reserveWindowButtons={reserveWindowButtons}
        />
        {!navigationInDrawer && (
          <AppShell.Navbar
            aria-label={t`Modules`}
            p="xs"
            pt={0}
            style={NAVBAR_STYLE}
            withBorder={false}
          >
            <NavbarColumn
              appearance={navbarIconsOnly ? "iconsOnly" : "labelled"}
              navigation={navigation}
            />
          </AppShell.Navbar>
        )}
        <AppShell.Main style={navigationInDrawer ? MAIN_WITHOUT_NAVBAR_STYLE : MAIN_STYLE}>
          <Box style={SHEET_STYLE}>
            <Splitter
              {...moduleSidebarResize.splitterProps}
              h="100%"
              attributes={{
                handle: {
                  "aria-label": t`Resize module sidebar`,
                  // A pointer drags by its own events, so only the keyboard needs the focus.
                  onMouseDown: (event: MouseEvent) => event.preventDefault(),
                },
              }}
              handleIcon={null}
              lineSize={GAP}
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
                {...moduleSidebarResize.paneProps}
                data-color-set={activeColor}
                style={MODULE_SIDEBAR_PANE_STYLE}
              >
                {moduleSidebarShown && (
                  <ScrollArea flex={1} mih={0}>
                    <Box p="xs">{moduleSidebar}</Box>
                  </ScrollArea>
                )}
              </Splitter.Pane>
              <Splitter.Pane
                defaultSize={100}
                data-color-set={activeColor}
                style={CONTENT_PANE_STYLE}
              >
                <ScrollArea flex={1} mih={0}>
                  <Box p="md">{children}</Box>
                </ScrollArea>
              </Splitter.Pane>
            </Splitter>
          </Box>
        </AppShell.Main>
        {isPhone && (
          <AppShell.Footer style={BOTTOM_BAR_STYLE} withBorder={false}>
            <ScrollArea h="100%" scrollbars="x" type="never">
              <Group aria-label={t`Modules`} component="nav" gap="xs" p={4} wrap="nowrap">
                {entries.map((entry) => entryLink(navigation, entry, "bottomBar"))}
                <CommandPaletteEntry appearance="bottomBar" />
                {entryLink(navigation, settingsEntry, "bottomBar")}
              </Group>
            </ScrollArea>
          </AppShell.Footer>
        )}
        <NavigationDrawer
          hasTopStrip={hasTopStrip}
          isPhone={isPhone}
          logo={logo}
          moduleSidebar={moduleSidebar}
          moduleSidebarWidth={moduleSidebarResize.shownWidth}
          navigation={navigation}
          onClose={closeDrawer}
          opened={navigationInDrawer && drawerOpened}
          reserveWindowButtons={reserveWindowButtons}
        />
        {editDrawer}
        {commandPalette}
        {shortcuts}
      </AppShell>
    </ShellRoutingContext>
  );
}

/** Contributions are translated at display time, including after a language switch. */
export interface ShellProps extends Omit<
  ShellFrameProps,
  | "entries"
  | "settingsEntry"
  | "activeEntryId"
  | "moduleSidebar"
  | "pageTitle"
  | "activeColor"
  | "editDrawer"
  | "commandPalette"
  | "shortcuts"
  | "indicatorModules"
> {
  readonly contributions: readonly ShellContribution[];
  readonly settings: ShellContribution;
  readonly activeModule: ShellContribution | undefined;
  readonly activeView: ShellView | undefined;
  /**
   * The Port access and notice seam every Command is given (D261): the app's `useDataAccess()`,
   * or a stand-in.
   */
  readonly data: DataAccess;
}

export function Shell({
  contributions,
  settings,
  activeModule,
  activeView,
  data,
  ...props
}: ShellProps) {
  const { i18n } = useLingui();
  const entryOf = (module: ShellContribution): NavigationEntry => ({
    id: module.id,
    to: viewPath(module.id, module.views[0].id),
    label: i18n._(module.name),
    icon: module.icon,
    color: module.color,
  });
  const commandScope: CommandScope = {
    owners: [...contributions, settings, shellCommands],
    activeModuleId: activeModule?.id,
  };
  return (
    <StartOnceProvider data={data}>
      <CommandPaletteProvider>
        <IndicatorPanelsProvider
          modules={contributions}
          page={`${activeModule?.id ?? ""}/${activeView?.id ?? ""}`}
        >
          <ShellFrame
            {...props}
            entries={contributions.map(entryOf)}
            indicatorModules={contributions}
            settingsEntry={entryOf(settings)}
            activeEntryId={activeModule?.id ?? ""}
            activeColor={activeModule?.color}
            pageTitle={activeView ? i18n._(activeView.title) : ""}
            editDrawer={<ModuleEditDrawer module={activeView && activeModule} />}
            commandPalette={<CommandPalette {...commandScope} />}
            shortcuts={<Shortcuts {...commandScope} />}
            moduleSidebar={
              <ModuleViews module={activeModule} activeView={activeView} routing={props.routing} />
            }
          />
        </IndicatorPanelsProvider>
      </CommandPaletteProvider>
    </StartOnceProvider>
  );
}

const loadedGroups = lazyComponents<Record<string, never>>();
const loadedDrawer = lazyComponents<EditDrawerProps>();
const NO_PROPS = {};

function ModuleViews({
  module,
  activeView,
  routing,
}: {
  readonly module: ShellContribution | undefined;
  readonly activeView: ShellView | undefined;
  readonly routing: ShellRouting;
}) {
  const { i18n, t } = useLingui();
  const closeOverlay = useCloseOverlayOnPick();
  if (!module) return null;
  return (
    <Stack gap="xs" data-color-set={module.color}>
      <Stack component="nav" aria-label={t`Module Sidebar`} gap="xs">
        {module.primaryAction && (
          <PrimaryAction moduleId={module.id} command={module.primaryAction} />
        )}
        {module.views.map((view) => (
          <NavLink
            key={view.id}
            component={routing.Link}
            to={viewPath(module.id, view.id)}
            label={i18n._(view.title)}
            active={view.id === activeView?.id}
            aria-current={view.id === activeView?.id ? "page" : undefined}
            onClick={closeOverlay}
            vars={ACTIVE_ENTRY_VARS}
          />
        ))}
      </Stack>
      {module.groups && (
        <LazyContribution
          key={module.id}
          components={loadedGroups}
          load={module.groups}
          props={NO_PROPS}
        />
      )}
    </Stack>
  );
}

interface EditTarget {
  readonly module: ShellContribution;
  readonly id: string;
}

const editTargetKey = ({ module, id }: EditTarget) => `${module.id}/${id}`;
/** Names one opening of an entry: each opening counts, also one of the same entry again. */
const openingKey = (target: EditTarget, opening: number) =>
  `${editTargetKey(target)}#${String(opening)}`;

/** The frame stays mounted whatever is open, so that closing can animate and return the focus. */
function ModuleEditDrawer({ module }: { readonly module: ShellContribution | undefined }) {
  const { t, i18n } = useLingui();
  const paletteOpen = useCommandPaletteOpen();
  const frame = useLayoutStep() === "phone" ? PHONE_EDIT_DRAWER : FLOATING_EDIT_DRAWER;
  const id = useViewSearch(selectEditId);
  const write = useWriteViewSearch();
  const target: EditTarget | undefined =
    module?.editDrawer && id !== undefined ? { module, id } : undefined;
  // The last target stays while the frame animates out. Drawer renders no children while closed,
  // so the module's code still only loads when it first opens. Each opening counts, also one of
  // the same entry during the exit: the content mounts anew and reads what it reads on opening.
  const [shown, setShown] = useState(target && { ...target, opening: 0 });
  const [wasOpen, setWasOpen] = useState(target !== undefined);
  const opensAnew =
    target !== undefined && (!wasOpen || target.module !== shown?.module || target.id !== shown.id);
  const openingNow = opensAnew ? (shown?.opening ?? 0) + 1 : (shown?.opening ?? 0);
  if (opensAnew) setShown({ ...target, opening: openingNow });
  if (wasOpen !== (target !== undefined)) setWasOpen(target !== undefined);
  // Held here, beside the View, so that naming the entry does not re-render it.
  const [entryTitle, setEntryTitle] = useState<string>();
  // Keyed by the opening as well: an editor mounted anew for the same entry, such as for a new
  // object of its module, is another opening, which a save of the one before cannot let pass.
  const exits = useEditDrawerExits(target && openingKey(target, openingNow));
  // Only writes the address. Whether that may happen is the guard's to decide.
  const close = () =>
    write((search) => {
      const { edit: _edit, ...rest } = search;
      return rest;
    });
  // Bound to the opening the content was mounted for, also while it slides out: a save that ends
  // after the person left this entry closes nothing, so it cannot close another entry past its
  // unsaved-changes guard.
  const shownOpening = shown && openingKey(shown, shown.opening);
  const openingProps = shownOpening !== undefined && {
    onDone: () => {
      if (exits.letNextExitPass(shownOpening)) close();
    },
    isOpen: () => exits.isOpen(shownOpening),
  };
  // The question and the Command Palette are modals of Mantine, which listen on the window like
  // the drawer: while one is open, Esc is theirs.
  // An Indicator Panel lies over the drawer: an Esc with the focus nowhere closes the panel only.
  const panels = useIndicatorPanels();
  const frameRef = useEscapeExit(
    target !== undefined && !exits.questionOpen && !paletteOpen,
    close,
    () => panels.current() !== undefined,
  );
  return (
    <Drawer
      {...frame}
      // Read by `openEditDrawer`.
      data-edit-drawer-open={target !== undefined || undefined}
      closeOnEscape={false}
      ref={frameRef}
      opened={target !== undefined}
      onClose={close}
      position="right"
      title={entryTitle ?? (shown && i18n._(shown.module.name))}
      closeButtonProps={{ "aria-label": t`Close editor`, ref: exits.closeButton }}
      styles={EDIT_DRAWER_STYLES}
    >
      {shown?.module.editDrawer && openingProps && (
        <EditDrawerTitleContext value={setEntryTitle}>
          <FrameContent
            components={loadedDrawer}
            load={shown.module.editDrawer}
            opening={shownOpening}
            props={{
              id: shown.id,
              onCancel: close,
              confirmDiscard: exits.confirmDiscard,
              ...openingProps,
            }}
            register={exits.register}
          />
        </EditDrawerTitleContext>
      )}
    </Drawer>
  );
}
