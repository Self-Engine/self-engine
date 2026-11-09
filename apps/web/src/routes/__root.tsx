import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Badge, Text } from "@mantine/core";
import { AssistantIcon, CalendarIcon, ProjectsIcon, SettingsIcon } from "@self-engine/icons";
import { BrandMark } from "@self-engine/icons/brand-mark";
import { useSetting } from "@self-engine/settings/react";
import { Shell, type ShellEntry, type ShellRouting } from "@self-engine/shell";
import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { channelBadge, reservesWindowButtons } from "../env.ts";
import { settingsStore } from "../settings-store.ts";
import { SHELL_SETTINGS } from "../shell-settings.ts";

// Until #20 the entries are the existing pages, so their icons and colors are placeholders.
const MODULES = [
  {
    to: "/",
    label: msg({ message: "Home", context: "page name" }),
    icon: ProjectsIcon,
    color: "blue",
  },
  {
    to: "/about",
    label: msg({ message: "About", context: "page name" }),
    icon: AssistantIcon,
    color: "teal",
  },
  { to: "/language-sample", label: msg`Language sample`, icon: CalendarIcon, color: "orange" },
] as const;

// #23 replaces the throwaway page with the settings area.
const SETTINGS = {
  to: "/theme-preview",
  label: msg`Theme preview`,
  icon: SettingsIcon,
  color: "grape",
} as const;

const ROUTING: ShellRouting = {
  Link: ({ to, target, ...props }) => (
    <Link {...props} {...(target !== undefined && { target })} to={to} />
  ),
};

const PAGES = [...MODULES, SETTINGS];

// The name of the product, which is not translated.
const LOGO = { mark: <BrandMark />, name: "Self-Engine" };

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  const { _ } = useLingui();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const badge = channelBadge(window);
  const activePage = PAGES.find(({ to }) => to === pathname);
  const navbar = useSetting(settingsStore, SHELL_SETTINGS.navbar);
  const moduleSidebarWidth = useSetting(settingsStore, SHELL_SETTINGS.moduleSidebarWidth);
  const moduleSidebarCollapsed = useSetting(settingsStore, SHELL_SETTINGS.moduleSidebarCollapsed);

  const entryOf = ({ to, label, icon, color }: (typeof PAGES)[number]): ShellEntry => ({
    id: to,
    to,
    label: _(label),
    icon,
    color,
  });

  return (
    <Shell
      activeEntryId={activePage?.to ?? ""}
      channelBadge={badge && <Badge variant="light">{badge}</Badge>}
      entries={MODULES.map(entryOf)}
      logo={LOGO}
      moduleSidebar={
        <Text c="dimmed" size="sm">
          <Trans>The views of the active module will appear here.</Trans>
        </Text>
      }
      moduleSidebarCollapsed={moduleSidebarCollapsed}
      moduleSidebarWidth={moduleSidebarWidth}
      navbar={navbar}
      onModuleSidebarCollapsedCommit={(collapsed) =>
        settingsStore.write(SHELL_SETTINGS.moduleSidebarCollapsed, collapsed)
      }
      onModuleSidebarWidthCommit={(width) =>
        settingsStore.write(SHELL_SETTINGS.moduleSidebarWidth, width)
      }
      onNavbarCommit={(next) => settingsStore.write(SHELL_SETTINGS.navbar, next)}
      routing={ROUTING}
      pageTitle={activePage ? _(activePage.label) : ""}
      reserveWindowButtons={reservesWindowButtons(window)}
      settingsEntry={entryOf(SETTINGS)}
    >
      <Outlet />
    </Shell>
  );
}
