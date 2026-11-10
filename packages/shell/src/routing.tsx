import {
  type ComponentPropsWithRef,
  type FunctionComponent,
  type MouseEvent,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { ViewSearch } from "./view-search.ts";

/** The Shell's link contract, implemented by the app's router or a Story adapter. */
export type ShellLinkProps = Omit<ComponentPropsWithRef<"a">, "href"> & {
  readonly to: string;
  readonly search?: ViewSearch | ((previous: ViewSearch) => ViewSearch);
};

export type WriteViewSearch = (update: (search: ViewSearch) => ViewSearch) => void;

/**
 * The address of the page on screen. During a slow navigation that is still the page being left,
 * because the Shell shows it until the next View is ready.
 */
export interface ViewAddress {
  readonly subscribe: (listener: () => void) => () => void;
  readonly search: () => ViewSearch;
  readonly writeSearch: WriteViewSearch;
  /**
   * A writer for the page on screen right now, for work that finishes later. It does nothing once
   * the user has left that page or is on the way to another one.
   */
  readonly scopedWriteSearch: () => WriteViewSearch;
}

/** One end of a change of the address. */
export interface LeavingAddress {
  readonly pathname: string;
  readonly search: ViewSearch;
}

interface LeaveAttempt {
  readonly current: LeavingAddress;
  readonly next: LeavingAddress;
}

/** Answers whether a change of the address may go ahead, asking the user first if it must. */
export type LeaveGuard = (attempt: LeaveAttempt) => boolean | Promise<boolean>;

/** One guard after the other, like the router, and the first "no" ends it. */
export async function askLeaveGuards(
  guards: Iterable<LeaveGuard>,
  attempt: LeaveAttempt,
): Promise<boolean> {
  for (const guard of guards) {
    // oxlint-disable-next-line no-await-in-loop -- a second question only after the first answer
    if (!(await guard(attempt))) return false;
  }
  return true;
}

export interface ShellRouting {
  readonly Link: FunctionComponent<ShellLinkProps>;
  readonly useAddress: () => ViewAddress;
  /**
   * Goes to a View and answers whether it became the page on screen, which for a slow View is once
   * it has loaded. `false` when a guard refused or another navigation overtook this one.
   */
  readonly useGoToView: () => (to: string) => Promise<boolean>;
  /**
   * Holds every change of the address until the guard answers, while `enabled` is true. That is
   * also Back and Forward. Give it a stable guard, because a new one is registered anew.
   */
  readonly useLeaveGuard: (guard: LeaveGuard, enabled: boolean) => void;
}

export const ShellRoutingContext = createContext<ShellRouting | null>(null);

export function useShellRouting(): ShellRouting {
  const routing = useContext(ShellRoutingContext);
  if (routing === null) throw new Error("Shell navigation needs a routing adapter");
  return routing;
}

/** Runs a selector once per search value, so that a fresh object is still one snapshot. */
function selectOncePerSearch<T>(read: () => ViewSearch, selector: (search: ViewSearch) => T) {
  let selected: { readonly search: ViewSearch; readonly value: T } | undefined;
  return () => {
    const search = read();
    if (selected?.search !== search) selected = { search, value: selector(search) };
    return selected.value;
  };
}

/** Select only the parameter a component needs. A primitive result redraws only when it changes. */
export function useViewSearch<T>(selector: (search: ViewSearch) => T): T {
  const { subscribe, search } = useShellRouting().useAddress();
  const select = useMemo(() => selectOncePerSearch(search, selector), [search, selector]);
  return useSyncExternalStore(subscribe, select);
}

export function useWriteViewSearch(): WriteViewSearch {
  return useShellRouting().useAddress().writeSearch;
}

/** Closes the overlay the Module Sidebar is shown in, where there is one. */
export const NavigationOverlayContext = createContext<(() => void) | null>(null);

/** Picking a View or a Group entry is the end of the overlay's job; a new tab leaves it open. */
export function useCloseOverlayOnPick() {
  const close = useContext(NavigationOverlayContext);
  return useCallback(
    (event: MouseEvent) => {
      const opensElsewhere = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey;
      if (!opensElsewhere) close?.();
    },
    [close],
  );
}
