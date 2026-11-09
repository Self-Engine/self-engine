import { useCallback, useSyncExternalStore } from "react";
import { retainedViewSearch, type ShellRouting } from "@self-engine/shell";
import { Link, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import { findModule } from "./modules.ts";

export const ROUTING: ShellRouting = {
  useSearch: (selector) => {
    const router = useRouter();
    const subscribe = useCallback(
      (notify: () => void) => router.subscribe("onResolved", notify),
      [router],
    );
    return useSyncExternalStore(subscribe, () => selector(router.state.location.search));
  },
  useWriteSearch: () => {
    const navigate = useNavigate();
    return (update) => {
      void navigate({ to: ".", search: update });
    };
  },
  Link: ({ to, search, target, ...props }) => {
    const location = useRouterState({ select: (state) => state.location });
    const from = location.pathname.split("/")[1] ?? "";
    const destination = to === "." ? location.pathname : to;
    const toModule = destination.split("/")[1] ?? "";
    const kept =
      (typeof search === "function" ? search(location.search) : search) ??
      retainedViewSearch(location.search, from, toModule, findModule(toModule)?.sharedSearch);
    return (
      <Link {...props} {...(target !== undefined && { target })} to={destination} search={kept} />
    );
  },
};
