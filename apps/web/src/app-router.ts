import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

/** Also used by the whole-app Stories, with a fresh router for each reload. */
export function createAppRouter(history: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: "intent", defaultPendingMs: Infinity });
}
