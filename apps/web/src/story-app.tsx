// Shared by the app's Stories. Not a story file, so the Catalog does not list it.

import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
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

const pressPaletteKey = () => {
  const mod = /mac/i.test(navigator.platform + navigator.userAgent) ? "Meta" : "Control";
  return userEvent.keyboard(`{${mod}>}k{/${mod}}`);
};

/** The bindings and the palette's code load late, so an early press is lost. */
export async function openPalette(): Promise<ReturnType<typeof within>> {
  await waitFor(
    async () => {
      await pressPaletteKey();
      await expect(screen.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    },
    { timeout: 10_000 },
  );
  return within(screen.getByRole("dialog", { name: "Command palette" }));
}

export const paletteGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull());

/** The entry that the address opens in the edit drawer. */
export const editInAddress = (router: AppRouter) =>
  (router.state.location.search as { readonly edit?: unknown }).edit;
