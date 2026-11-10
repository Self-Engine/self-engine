// Shared by the app's Stories. Not a story file, so the Catalog does not list it.

import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { createAppRouter } from "./app-router.ts";

type AppRouter = ReturnType<typeof createAppRouter>;

let lastRouter: AppRouter;

/** The router of the app that `AppAt` last rendered. */
export const storyRouter = () => lastRouter;

/** The whole app at `address`, on a history that stays in memory. */
export function AppAt({ address }: { readonly address: string }) {
  const [router] = useState(() => {
    lastRouter = createAppRouter(createMemoryHistory({ initialEntries: [address] }));
    return lastRouter;
  });
  return <RouterProvider router={router} />;
}

/** The entry that the address opens in the edit drawer. */
export const editInAddress = (router: AppRouter) =>
  (router.state.location.search as { readonly edit?: unknown }).edit;
