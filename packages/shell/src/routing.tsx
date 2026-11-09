import {
  type ComponentPropsWithRef,
  type FunctionComponent,
  createContext,
  useContext,
} from "react";

import type { ViewSearch } from "./view-search.ts";

/** The Shell's link contract, implemented by the app's router or a Story adapter. */
export type ShellLinkProps = Omit<ComponentPropsWithRef<"a">, "href"> & {
  readonly to: string;
  readonly search?: ViewSearch | ((previous: ViewSearch) => ViewSearch);
};

export interface ShellRouting {
  readonly Link: FunctionComponent<ShellLinkProps>;
  readonly useSearch: <T>(selector: (search: ViewSearch) => T) => T;
  readonly useWriteSearch: () => (update: (search: ViewSearch) => ViewSearch) => void;
}

export const ShellRoutingContext = createContext<ShellRouting | null>(null);

export function useShellRouting(): ShellRouting {
  const routing = useContext(ShellRoutingContext);
  if (routing === null) throw new Error("Shell navigation needs a routing adapter");
  return routing;
}

/** Select only the parameter a component needs. Selectors should return stable values. */
export function useViewSearch<T>(selector: (search: ViewSearch) => T): T {
  return useShellRouting().useSearch(selector);
}

export function useWriteViewSearch() {
  return useShellRouting().useWriteSearch();
}
