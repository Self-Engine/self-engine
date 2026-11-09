import {
  type ComponentPropsWithRef,
  type FunctionComponent,
  createContext,
  useContext,
} from "react";

/** The Shell's link contract, implemented by the app's router or a Story adapter. */
export type ShellLinkProps = Omit<ComponentPropsWithRef<"a">, "href"> & { readonly to: string };

export interface ShellRouting {
  readonly Link: FunctionComponent<ShellLinkProps>;
}

export const ShellRoutingContext = createContext<ShellRouting | null>(null);

export function useShellRouting(): ShellRouting {
  const routing = useContext(ShellRoutingContext);
  if (routing === null) throw new Error("Shell navigation needs a routing adapter");
  return routing;
}
