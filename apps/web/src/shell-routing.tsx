import { useCallback, useMemo, type ComponentPropsWithRef } from "react";
import {
  retainedViewSearch,
  type ShellRouting,
  type ViewAddress,
  type ViewSearch,
  type WriteViewSearch,
} from "@self-engine/shell";
import {
  type AnyRouter,
  createLink,
  type ShouldBlockFn,
  useBlocker,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { findModule } from "./modules.ts";

/** What the Shell shows: the page being left, until the next one has loaded. */
export function visibleLocation<Location>(state: {
  readonly location: Location;
  readonly resolvedLocation?: Location | undefined;
}): Location {
  return state.resolvedLocation ?? state.location;
}

type AnchorProps = ComponentPropsWithRef<"a"> & {
  readonly currentEntry: ComponentPropsWithRef<"a">["aria-current"];
  readonly disabled?: boolean | undefined;
};

/** The router has its own idea of which link is active; here only the Shell's counts. */
const RouterLink = createLink(function Anchor({
  currentEntry,
  "aria-current": _routerCurrent,
  disabled: _disabled,
  ...props
}: AnchorProps) {
  return <a {...props} aria-current={currentEntry} />;
});

function createAddress(router: AnyRouter): ViewAddress {
  const onScreen = () => visibleLocation(router.state);
  const writeSearch: WriteViewSearch = (update) => {
    const { pathname, search } = onScreen();
    // Builds on an earlier write to this page that is still on its way.
    const base =
      router.latestLocation.pathname === pathname ? router.latestLocation.search : search;
    void router.navigate({ to: pathname, search: update(base as ViewSearch) });
  };
  return {
    subscribe: (listener) => router.subscribe("onResolved", listener),
    search: () => onScreen().search as ViewSearch,
    writeSearch,
    scopedWriteSearch: () => {
      const origin = onScreen().pathname;
      return (update) => {
        if (onScreen().pathname === origin && router.latestLocation.pathname === origin) {
          writeSearch(update);
        }
      };
    },
  };
}

export const ROUTING: ShellRouting = {
  useAddress: () => {
    const router = useRouter();
    return useMemo(() => createAddress(router), [router]);
  },
  useLeaveGuard: (guard, enabled) => {
    const shouldBlockFn = useCallback<ShouldBlockFn>(
      async ({ current, next }) => !(await guard({ current, next })),
      [guard],
    );
    // A blocked unload is cancelled silently in Electron and would stand in the way of quitting.
    useBlocker({ shouldBlockFn, disabled: !enabled, enableBeforeUnload: false });
  },
  Link: ({ to, search, target, "aria-current": current, ...props }) => {
    const location = useRouterState({ select: visibleLocation });
    const from = location.pathname.split("/")[1] ?? "";
    const destination = to === "." ? location.pathname : to;
    const toModule = destination.split("/")[1] ?? "";
    const kept =
      (typeof search === "function" ? search(location.search) : search) ??
      retainedViewSearch(location.search, from, toModule, findModule(toModule)?.sharedSearch);
    return (
      <RouterLink
        {...props}
        {...(target !== undefined && { target })}
        currentEntry={current}
        to={destination}
        search={kept}
      />
    );
  },
};
