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

const ON_MAC = /mac/i.test(navigator.platform + navigator.userAgent);
const MOD = ON_MAC ? "Meta" : "Control";

/** Presses a shortcut the way this platform spells `Mod`. */
export const pressWithMod = (key: string) => userEvent.keyboard(`{${MOD}>}${key}{/${MOD}}`);

/**
 * The key's own events on `target`, because a scripted press with Meta would type the letter into
 * a field. Says whether the browser may still give the key its usual meaning.
 */
export function modKeyIsLeftToTheBrowser(target: Element, key: string) {
  const init = {
    key,
    code: `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true,
    ...(ON_MAC ? { metaKey: true } : { ctrlKey: true }),
  };
  const notPrevented = target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
  return notPrevented;
}

/** The bindings and the palette's code load late, so an early press is lost. */
export async function openPalette(name = "Command palette"): Promise<ReturnType<typeof within>> {
  await waitFor(
    async () => {
      await pressWithMod("k");
      await expect(screen.getByRole("dialog", { name })).toBeVisible();
    },
    { timeout: 10_000 },
  );
  return within(screen.getByRole("dialog", { name }));
}

export const paletteGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull());

/** The entry that the address opens in the edit drawer. */
export const editInAddress = (router: AppRouter) =>
  (router.state.location.search as { readonly edit?: unknown }).edit;
