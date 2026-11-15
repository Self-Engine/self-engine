import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { parseAddressSearch, stringifyAddressSearch } from "./address-search.ts";
import type { AppRouterContext, ModuleList } from "./module-list.ts";
import { routeTree } from "./routeTree.gen.ts";

/**
 * The app's router over `moduleList`: the app's own list, or a story's, with a fresh router for
 * each reload.
 */
export function createAppRouter(history: RouterHistory, moduleList: ModuleList) {
  return createRouter({
    routeTree,
    history,
    context: { moduleList } satisfies AppRouterContext,
    defaultPreload: "intent",
    defaultPendingMs: Infinity,
    parseSearch: parseAddressSearch,
    stringifySearch: stringifyAddressSearch,
  });
}
