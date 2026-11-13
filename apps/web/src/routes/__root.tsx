import { ROUTING, visibleLocation } from "../shell-routing.tsx";
import { Badge } from "@mantine/core";
import { BrandMark } from "@self-engine/icons/brand-mark";
import { useDataAccess } from "@self-engine/data-client/react";
import { useSetting } from "@self-engine/settings/react";
import { Shell } from "@self-engine/shell";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { DataConnectionStates } from "../data-connection-states.tsx";
import { dataConnection, retryDesktopData } from "../desktop-data.ts";
import { channelBadge, reservesWindowButtons } from "../env.ts";
import { settingsStore } from "../settings-store.ts";
import { modules, settings, findModule } from "../modules.ts";
import { NotFound, ViewLoadError } from "../route-states.tsx";
import { SHELL_SETTINGS } from "../shell-settings.ts";

// The name of the product, which is not translated.
const LOGO = { mark: <BrandMark />, name: "Self-Engine" };

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: ViewLoadError,
});

function RootLayout() {
  const { pathname } = useRouterState({ select: visibleLocation });
  const badge = channelBadge(window);
  const [, moduleId, viewId] = pathname.split("/");
  const activeModule = findModule(moduleId ?? "");
  const activeView = activeModule?.views.find((view) => view.id === viewId);
  const navbar = useSetting(settingsStore, SHELL_SETTINGS.navbar);
  const moduleSidebarWidth = useSetting(settingsStore, SHELL_SETTINGS.moduleSidebarWidth);
  const moduleSidebarCollapsed = useSetting(settingsStore, SHELL_SETTINGS.moduleSidebarCollapsed);
  // The Commands reach the Data Process, and show their notices, through what the page's
  // `DataProvider` was given.
  const data = useDataAccess();

  const shell = (
    <Shell
      activeModule={activeModule}
      activeView={activeView}
      channelBadge={badge && <Badge variant="light">{badge}</Badge>}
      contributions={modules}
      data={data}
      logo={LOGO}
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
      reserveWindowButtons={reservesWindowButtons(window)}
      settings={settings}
    >
      <Outlet />
    </Shell>
  );
  // Without the desktop app the connection is stopped from the start, and nothing can start a
  // Data Process again, so there is no retry (D263).
  const bridge = window.desktopBridge;
  return (
    <DataConnectionStates
      connection={dataConnection}
      onRetry={bridge && (() => retryDesktopData(bridge, dataConnection))}
    >
      {shell}
    </DataConnectionStates>
  );
}
