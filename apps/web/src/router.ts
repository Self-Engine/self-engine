import { createBrowserHistory, createHashHistory, createRouter } from "@tanstack/react-router";
import { historyKind } from "./env.ts";
import { routeTree } from "./routeTree.gen.ts";

export const router = createRouter({
  routeTree,
  history: historyKind(window) === "hash" ? createHashHistory() : createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
