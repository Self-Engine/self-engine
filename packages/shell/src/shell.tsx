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
  useMatches,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { SidePanelIcon } from "@self-engine/icons";
import { type ColorSetId, roleColor } from "@self-engine/theme";
import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
} from "react";
import {
  GAP,
  ICON_COLUMN_WIDTH,
  LOGO_START_ON_ICON_AXIS,
  NAVBAR_ICONS_ONLY_WIDTH,
  navbarLimits,
  SHELL_STANDARD_NAVBAR,
  type ShellNavbarState,
  START_AFTER_WINDOW_BUTTONS_PX,
} from "./navbar-geometry.ts";
import {
  SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  useModuleSidebarResize,
} from "./use-module-sidebar-resize.ts";
import { useNavbarResize } from "./use-navbar-resize.ts";

const CONTENT_HEADER_HEIGHT = 48;
const BOTTOM_BAR_HEIGHT = 64;
const ENTRY_HEIGHT = 40;
/** As high as the content header and level with it, so window buttons, logo and page title share a line. */
const TOP_STRIP_HEIGHT = CONTENT_HEADER_HEIGHT;
const START_AFTER_WINDOW_BUTTONS = `${START_AFTER_WINDOW_BUTTONS_PX}px`;
/** The same place from inside the frame, for the content header that the buttons float over. */
const HEADER_START_AFTER_WINDOW_BUTTONS = `calc(${START_AFTER_WINDOW_BUTTONS} - ${rem(GAP)})`;
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

/** One geometry with and without a label, so that only the label goes. */
const NAVBAR_ENTRY_STYLES = {
  root: { ...ENTRY_ROOT_STYLE, height: rem(ENTRY_HEIGHT), padding: 0 },
  // As wide as the icons-only Navbar has room, so an icon sits on its axis at every width.
  section: { flex: "none", marginInlineEnd: 0, width: rem(ICON_COLUMN_WIDTH) },
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

/** The app's brand. The Shell only places it: its artwork comes in from outside. */
export interface ShellLogo {
  readonly mark: ReactNode;
  /** Shown beside the mark. The Navbar's minimum width is measured for "Self-Engine", so a longer name can overflow a Navbar at that minimum. */
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
  /** Sits in the top strip of the navigation, in the drawer at the narrow step, and in the content header while the Navbar holds the window buttons. None at phone width. */
  readonly logo?: ShellLogo;
  /** The free end of the content header. */
  readonly headerEnd?: ReactNode;
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
  /** Keeps room for the macOS window buttons: in the navigation's top strip, on an icons-only Navbar widened to hold them while the Module Sidebar is closed, and in the content header at the narrow step. */
  readonly reserveWindowButtons?: boolean;
  /** The page. Stays mounted whichever Layout Step the window is in. */
  readonly children: ReactNode;
}

/** The band at the top of a navigation surface, which moves the window. It can hold the logo. */
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
  readonly style?: CSSProperties;
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

/** The entries and what happens to them, wherever the navigation is shown. */
type ShellNavigation = Pick<
  ShellProps,
  "entries" | "settingsEntry" | "activeEntryId" | "onSelectEntry"
>;

function entryLink(
  { activeEntryId, onSelectEntry }: ShellNavigation,
  entry: ShellEntry,
  appearance: EntryLinkProps["appearance"],
) {
  return (
    <EntryLink
      active={entry.id === activeEntryId}
      appearance={appearance}
      entry={entry}
      key={entry.id}
      onSelect={onSelectEntry}
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
        {entryLink(navigation, navigation.settingsEntry, appearance)}
      </AppShell.Section>
    </>
  );
}

/** Props the Shell hands on as they came in, given or not. */
type PassedOn<Name extends keyof ShellProps> = {
  readonly [Key in Name]-?: ShellProps[Key] | undefined;
};

interface ContentHeaderProps extends PassedOn<
  | "pageTitle"
  | "headerEnd"
  | "channelBadge"
  | "moduleSidebarCollapsed"
  | "onModuleSidebarCollapsedCommit"
> {
  readonly startsAfterWindowButtons: boolean;
  /** Set while the Navbar holds the window buttons, which is where the mark goes instead. */
  readonly logo: ShellLogo | undefined;
  readonly isPhone: boolean;
  readonly navigationInDrawer: boolean;
  readonly drawerOpened: boolean;
  readonly onToggleDrawer: () => void;
}

function ContentHeader({
  pageTitle,
  headerEnd,
  channelBadge,
  moduleSidebarCollapsed,
  onModuleSidebarCollapsedCommit,
  startsAfterWindowButtons,
  logo,
  isPhone,
  navigationInDrawer,
  drawerOpened,
  onToggleDrawer,
}: ContentHeaderProps) {
  const { t } = useLingui();
  return (
    <Group
      flex="none"
      gap="sm"
      h={rem(CONTENT_HEADER_HEIGHT)}
      pe="md"
      ps={startsAfterWindowButtons ? HEADER_START_AFTER_WINDOW_BUTTONS : "md"}
      style={WINDOW_DRAG_STYLE}
      wrap="nowrap"
    >
      {logo && <Logo logo={logo} markOnly />}
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
      {headerEnd && <Box style={NOT_WINDOW_DRAG_STYLE}>{headerEnd}</Box>}
    </Group>
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
  const header = (
    <Drawer.Header>
      <Drawer.Title>{t`Module Sidebar`}</Drawer.Title>
      <Drawer.CloseButton aria-label={isPhone ? t`Close module sidebar` : t`Close navigation`} />
    </Drawer.Header>
  );
  return (
    <Drawer.Root
      onClose={onClose}
      opened={opened}
      size={
        isPhone ? moduleSidebarWidth : NAVBAR_ICONS_ONLY_WIDTH + SHELL_STANDARD_MODULE_SIDEBAR_WIDTH
      }
      styles={isPhone ? DRAWER_STYLES : NAVIGATION_DRAWER_STYLES}
    >
      <Drawer.Overlay />
      <Drawer.Content>
        {isPhone ? (
          <>
            {header}
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
                <NavbarColumn appearance="iconsOnly" navigation={navigation} />
              </Box>
              <Stack flex={1} gap={0} miw={0}>
                {header}
                <ScrollArea flex={1} mih={0}>
                  <Drawer.Body pt={0}>{moduleSidebar}</Drawer.Body>
                </ScrollArea>
              </Stack>
            </Group>
          </>
        )}
      </Drawer.Content>
    </Drawer.Root>
  );
}

/**
 * The frame of the app. Knows no router and no Settings: everything comes in as props. It checks
 * for no platform either, but it does carry the geometry of the macOS window buttons, which
 * `reserveWindowButtons` switches on.
 */
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
  const navigation = { entries, settingsEntry, activeEntryId, onSelectEntry };

  const isPhone = step === "phone";
  const navigationInDrawer = isPhone || step === "narrow";
  // The pane stays either way and is only empty, so that the page beside it does not remount.
  const moduleSidebarShown = !navigationInDrawer && !moduleSidebarCollapsed;
  const navbarStandsAlone = !navigationInDrawer && moduleSidebarCollapsed;
  // Whatever form the Navbar has right now: a drag has to know the width it would collapse to.
  const limits = navbarLimits({
    scale: theme.scale,
    reserveWindowButtons,
    standsAlone: navbarStandsAlone,
  });
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
  const navbarIconsOnly = step !== "wide" || navbarResize.collapsed;
  const hasTopStrip = reserveWindowButtons || logo !== undefined;
  const logoMarkOnly = navbarStandsAlone && navbarIconsOnly;
  // The form on screen, which a drag changes before its commit. The buttons take the logo's place.
  const navbarHoldsWindowButtons = reserveWindowButtons && logoMarkOnly;
  // Keeps the entries in their column, so the wider icons-only Navbar only adds room on both sides.
  const iconsOnlyNavbarPadding = rem((limits.iconsOnlyWidth - ICON_COLUMN_WIDTH) / 2);
  const hasNavigationStrip = hasTopStrip && !navigationInDrawer;
  const topStripHeight = hasNavigationStrip ? rem(TOP_STRIP_HEIGHT) : 0;

  useEffect(() => {
    if (!navigationInDrawer) closeDrawer();
  }, [navigationInDrawer, closeDrawer]);

  return (
    <AppShell
      {...(isPhone && { footer: { height: BOTTOM_BAR_HEIGHT } })}
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
      // Starts below the strip with the divider, so nothing but the drag region is up there.
      styles={{ resizeHandle: { ...NOT_WINDOW_DRAG_STYLE, top: topStripHeight } }}
    >
      <Box aria-hidden style={TOP_EDGE_STYLE} />
      {!navigationInDrawer && (
        <AppShell.Navbar
          aria-label={t`Modules`}
          px={navbarHoldsWindowButtons ? iconsOnlyNavbarPadding : "xs"}
          py="xs"
          style={navbarStandsAlone ? NAVBAR_ALONE_STYLE : NAVBAR_STYLE}
          withBorder={false}
        >
          {hasNavigationStrip && (
            <TopStrip
              style={
                // The buttons float over the column, so only the padding around it can drag the window.
                navbarHoldsWindowButtons
                  ? {
                      ...NAVBAR_TOP_STRIP_STYLE,
                      marginInline: `calc(-1 * ${iconsOnlyNavbarPadding})`,
                    }
                  : NAVBAR_TOP_STRIP_STYLE
              }
            />
          )}
          {moduleSidebarShown && (
            <Box aria-hidden style={{ ...NAVBAR_DIVIDER_STYLE, top: topStripHeight }} />
          )}
          <NavbarColumn
            appearance={navbarIconsOnly ? "iconsOnly" : "labelled"}
            navigation={navigation}
          />
        </AppShell.Navbar>
      )}
      {logo && !navigationInDrawer && !navbarHoldsWindowButtons && (
        <Logo
          logo={logo}
          markOnly={logoMarkOnly}
          style={{
            ...NAVIGATION_LOGO_STYLE,
            insetInlineStart: reserveWindowButtons
              ? START_AFTER_WINDOW_BUTTONS
              : rem(LOGO_START_ON_ICON_AXIS),
          }}
        />
      )}
      <AppShell.Main style={navbarStandsAlone ? MAIN_BESIDE_NAVBAR_ALONE_STYLE : MAIN_STYLE}>
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
          <Splitter.Pane {...moduleSidebarResize.paneProps} style={MODULE_SIDEBAR_PANE_STYLE}>
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
            <ContentHeader
              channelBadge={channelBadge}
              drawerOpened={drawerOpened}
              headerEnd={headerEnd}
              isPhone={isPhone}
              logo={navbarHoldsWindowButtons ? logo : undefined}
              moduleSidebarCollapsed={moduleSidebarCollapsed}
              navigationInDrawer={navigationInDrawer}
              onModuleSidebarCollapsedCommit={onModuleSidebarCollapsedCommit}
              onToggleDrawer={toggleDrawer}
              pageTitle={pageTitle}
              startsAfterWindowButtons={step === "narrow" && reserveWindowButtons}
            />
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
              {[...entries, settingsEntry].map((entry) =>
                entryLink(navigation, entry, "bottomBar"),
              )}
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
    </AppShell>
  );
}
