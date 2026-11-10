import { useCallback, useEffect, useMemo, type ComponentPropsWithRef } from "react";
import {
  askLeaveGuards,
  type LeaveGuard,
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

interface SearchedLocation {
  readonly pathname: string;
  readonly search: ViewSearch;
}

const moduleOfPath = (pathname: string) => pathname.split("/")[1] ?? "";

function keptSearch(location: SearchedLocation, destination: string) {
  const toModule = moduleOfPath(destination);
  return retainedViewSearch(
    location.search,
    moduleOfPath(location.pathname),
    toModule,
    findModule(toModule)?.sharedSearch,
  );
}

const registeredGuards = new WeakMap<AnyRouter, Set<LeaveGuard>>();

function leaveGuardsOf(router: AnyRouter) {
  const known = registeredGuards.get(router);
  if (known) return known;
  const created = new Set<LeaveGuard>();
  registeredGuards.set(router, created);
  return created;
}

/**
 * Asks the guards itself and then passes over the router's blocker, because a push the blocker
 * refuses leaves the promise of `navigate` open until some later navigation finishes.
 */
async function goToView(router: AnyRouter, to: string) {
  const search = keptSearch(visibleLocation(router.state), to);
  const { pathname, search: currentSearch } = router.latestLocation;
  const attempt = {
    current: { pathname, search: currentSearch as ViewSearch },
    next: { pathname: to, search },
  };
  if (!(await askLeaveGuards(leaveGuardsOf(router), attempt))) return false;
  await router.navigate({ to, search, ignoreBlocker: true });
  return visibleLocation(router.state).pathname === to;
}

/**
 * How far the browser's history moved from the entry the router is still on. Unknown on an entry
 * the router did not write, such as a hand-edited hash: it has no index to measure from.
 */
function stepsTraversed(history: AnyRouter["history"]): number | undefined {
  const browserEntry = window.history.state as Partial<typeof history.location.state> | null;
  const target = browserEntry?.__TSR_index;
  return target === undefined ? undefined : target - history.location.state.__TSR_index;
}

export const ROUTING: ShellRouting = {
  useAddress: () => {
    const router = useRouter();
    return useMemo(() => createAddress(router), [router]);
  },
  useGoToView: () => {
    const router = useRouter();
    return useCallback((to) => goToView(router, to), [router]);
  },
  useLeaveGuard: (guard, enabled) => {
    const router = useRouter();
    useEffect(() => {
      if (!enabled) return undefined;
      const guards = leaveGuardsOf(router);
      guards.add(guard);
      return () => {
        guards.delete(guard);
      };
    }, [guard, enabled, router]);
    const shouldBlockFn = useCallback<ShouldBlockFn>(
      ({ action, current, next }) => {
        const answer = guard({ current, next });
        if (typeof answer === "boolean") return !answer;
        // Read here, while a traversing browser is still on the target.
        const steps =
          action === "PUSH" || action === "REPLACE" ? undefined : stepsTraversed(router.history);
        if (steps === undefined) return answer.then((leave) => !leave);
        // The browser has already moved. Left there until the answer, a second Back would be
        // measured from the wrong entry and undo the wrong distance, so it goes back at once and
        // the step is taken again on "yes".
        void answer.then((leave) => {
          if (leave) router.history.go(steps, { ignoreBlocker: true });
        });
        return true;
      },
      [guard, router],
    );
    // A blocked unload is cancelled silently in Electron and would stand in the way of quitting.
    useBlocker({ shouldBlockFn, disabled: !enabled, enableBeforeUnload: false });
  },
  Link: ({ to, search, target, "aria-current": current, ...props }) => {
    const location = useRouterState({ select: visibleLocation });
    const destination = to === "." ? location.pathname : to;
    const kept =
      (typeof search === "function" ? search(location.search) : search) ??
      keptSearch(location, destination);
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
