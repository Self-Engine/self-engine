import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Badge, Text } from "@mantine/core";
import { AssistantIcon, CalendarIcon, ProjectsIcon, SettingsIcon } from "@self-engine/icons";
import { BrandMark } from "@self-engine/icons/brand-mark";
import {
  Shell,
  SHELL_STANDARD_MODULE_SIDEBAR_WIDTH,
  SHELL_STANDARD_NAVBAR,
  type ShellEntry,
} from "@self-engine/shell";
import { Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { channelBadge, reservesWindowButtons } from "../env.ts";

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

const PAGES = [...MODULES, SETTINGS];

// The name of the product, which is not translated.
const LOGO = { mark: <BrandMark />, name: "Self-Engine" };

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const badge = channelBadge(window);
  const activePage = PAGES.find(({ to }) => to === pathname);
  // Held in memory until #87 stores them as Device Settings.
  const [navbar, setNavbar] = useState(SHELL_STANDARD_NAVBAR);
  const [moduleSidebarWidth, setModuleSidebarWidth] = useState(SHELL_STANDARD_MODULE_SIDEBAR_WIDTH);

  const entryOf = ({ to, label, icon, color }: (typeof PAGES)[number]): ShellEntry => ({
    id: to,
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
      moduleSidebarWidth={moduleSidebarWidth}
      navbar={navbar}
      onModuleSidebarWidthCommit={setModuleSidebarWidth}
      onNavbarCommit={setNavbar}
      onSelectEntry={(id) => {
        const page = PAGES.find(({ to }) => to === id);
        if (page) void navigate({ to: page.to });
      }}
      pageTitle={activePage ? _(activePage.label) : ""}
      reserveWindowButtons={reservesWindowButtons(window)}
      settingsEntry={entryOf(SETTINGS)}
    >
      <Outlet />
    </Shell>
  );
}
