// Shared by the app's Stories. Not a story file, so the Catalog does not list it.

import { DataProvider, type PortAccess } from "@self-engine/data-client/react";
import { LANGUAGE_TAGS, loadAppCatalog } from "@self-engine/i18n";
import { loadStoryShell, modKey } from "@self-engine/shell/story-interactions";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { createAppRouter } from "./app-router.ts";
import { contributions } from "./modules.ts";
import { settingsStore } from "./settings-store.ts";

/**
 * Finish fetching the app's lazy code before a Story starts interacting. On a cold dev server,
 * compiling a View or drawer can outlast a DOM query's deadline under load. Storybook awaits
 * loaders before `beforeEach`, so stories can still replace a load with slow or failing work.
 * Every story rendering AppAt or createAppRouter must install this loader in its meta (or call
 * it from its own loader). Do not move it into AppAt: that would invoke the beforeEach mocks.
 */
export async function loadStoryApp() {
  await Promise.all([
    settingsStore.load(),
    loadStoryShell(),
    ...LANGUAGE_TAGS.map(loadAppCatalog),
    ...contributions.flatMap((module) => [
      ...module.views.map((view) => view.load()),
      module.groups?.(),
      module.editDrawer?.(),
      ...(module.commands ?? []).map((command) => command.load()),
    ]),
  ]);
}

type AppRouter = ReturnType<typeof createAppRouter>;

let lastRouter: AppRouter;

/** The router of the app that `AppAt` last rendered. */
export const storyRouter = () => lastRouter;

export interface AppAtProps {
  readonly address: string;
  /**
   * What the Port answers: Fixed Answers from the story file, which alone may build them (D255),
   * or the page's real connection.
   */
  readonly access: PortAccess;
}

/** The whole app at `address`, on a history that stays in memory, with its own query cache. */
export function AppAt({ address, access }: AppAtProps) {
  const [router] = useState(() => {
    lastRouter = createAppRouter(createMemoryHistory({ initialEntries: [address] }));
    return lastRouter;
  });
  return (
    <DataProvider access={access}>
      <RouterProvider router={router} />
    </DataProvider>
  );
}

export {
  answer,
  asked,
  noQuestion,
  openPalette,
  paletteGone,
  pressWithMod,
  QUESTION,
} from "@self-engine/shell/story-interactions";

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
    ...(modKey() === "Meta" ? { metaKey: true } : { ctrlKey: true }),
  };
  const notPrevented = target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
  return notPrevented;
}

/** The entry that the address opens in the edit drawer. */
export const editInAddress = (router: AppRouter) =>
  (router.state.location.search as { readonly edit?: unknown }).edit;

/** Work the story finishes by hand, so a slow load is deterministic. */
export function held<T>() {
  let finish!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

export const noDrawer = (name: string) =>
  waitFor(() => expect(screen.queryByRole("dialog", { name })).toBeNull());

/** Opens the entry from the list, so that there is a history entry to go back from. */
export async function editStudio(canvas: ReturnType<typeof within>) {
  await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
  const drawer = await screen.findByRole("dialog", { name: "Studio work" });
  const name = await within(drawer).findByRole("textbox", { name: "Name" });
  await userEvent.type(name, " changed");
  return { drawer: within(drawer), name };
}
