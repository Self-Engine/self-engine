import { createBrowserHistory, createHashHistory } from "@tanstack/react-router";
import { createAppRouter } from "./app-router.ts";
import { historyKind } from "./env.ts";
import { appModules } from "./modules.ts";

export const router = createAppRouter(
  historyKind(window) === "hash" ? createHashHistory() : createBrowserHistory(),
  appModules,
);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
