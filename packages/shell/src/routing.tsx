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

export interface ShellRouting {
  readonly Link: FunctionComponent<ShellLinkProps>;
  readonly useAddress: () => ViewAddress;
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
