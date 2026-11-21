// Shared by the app's Stories. Not a story file, so the Catalog does not list it.

import { DataProvider, type PortAccess } from "@self-engine/data-client/react";
import { LANGUAGE_TAGS, loadAppCatalog } from "@self-engine/i18n";
import { type Clock, type Region, resolveTimeZone, type TimeZone } from "@self-engine/time";
import { PageClockProvider, TimeSettingsProvider } from "@self-engine/time/react";
import { alwaysVisible } from "@self-engine/time/testing";
import { holdTimers } from "@self-engine/ui/story-timers";
import { loadStoryShell, modKey } from "@self-engine/shell/story-interactions";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { createAppRouter } from "./app-router.ts";
import type { ModuleList } from "./module-list.ts";
import { appReasonTexts } from "./reason-texts.ts";
import { settingsStore } from "./settings-store.ts";
import { STORY_CLOCK, storyModules } from "./story-modules.ts";

export { STORY_CLOCK, storyModules };

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
    ...storyModules.contributions.flatMap((module) => [
      ...module.views.map((view) => view.load()),
      module.groups?.(),
      module.editDrawer?.(),
      module.indicator?.load(),
      module.indicator?.panel?.(),
      ...(module.commands ?? []).map((command) => command.load()),
    ]),
  ]);
}

/** The device's zone in the app's stories, which the Time Zone shows while none is set. */
export const STORY_DEVICE_ZONE = resolveTimeZone("Europe/Berlin").timeZone;

const throwError = (error: Error) => {
  throw error;
};

/**
 * The time of a story's page: its Clock, the device's zone, which the Time Zone follows while
 * none is set, and the region of the App Language, which an "Automatic" week start follows.
 */
export interface StoryTime {
  readonly clock?: Clock;
  readonly deviceZone?: TimeZone;
  readonly region?: Region;
}

/**
 * The time settings and the page's Clock as `main.tsx` provides them, with a named device zone
 * and region and the fixed Clock the stories' settings area gets too, so that a story renders the
 * same everywhere and on every day. Every story that mounts the app's router needs it.
 */
export function StoryTimeSettings({
  children,
  clock = STORY_CLOCK,
  deviceZone = STORY_DEVICE_ZONE,
  region = "en-US",
}: StoryTime & { readonly children: ReactNode }) {
  return (
    <TimeSettingsProvider
      deviceZone={deviceZone}
      onError={throwError}
      region={region}
      store={settingsStore}
    >
      <PageClockProvider clock={clock} visibility={alwaysVisible}>
        {children}
      </PageClockProvider>
    </TimeSettingsProvider>
  );
}

/** The app's Reason texts, with the table names of the stories' modules. */
const storyReasonTexts = appReasonTexts(storyModules);

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
  /** Names of tables contributed by a story's test modules. */
  readonly testTableName?: ModuleList["tableName"];
  /** Another Clock, device zone or region than the stories' fixed ones. */
  readonly time?: StoryTime;
  /**
   * Whether `access` answers the running timers. Every page draws the timer's Module Indicator;
   * without this, it finds no timer running, so a story of another module needs no answer for it.
   */
  readonly answersTimers?: boolean;
}

/**
 * The access of a story that shows no timer: the timer's Module Indicator, on every page, finds
 * none running. An empty list needs no Fixed Answer: there is nothing in it to check.
 */
export function withNoTimerRunning(access: PortAccess): PortAccess {
  return {
    ...access,
    call: (module, entry, input, signal) =>
      module === "timeTracking" && entry === "runningTimers"
        ? Promise.resolve([])
        : access.call(module, entry, input, signal),
  };
}

/** The whole app at `address`, on a history that stays in memory, with its own query cache. */
export function AppAt({ address, access, testTableName, time, answersTimers }: AppAtProps) {
  const [router] = useState(() => {
    lastRouter = createAppRouter(createMemoryHistory({ initialEntries: [address] }), storyModules);
    return lastRouter;
  });
  const [reasonTexts] = useState(() =>
    testTableName === undefined
      ? storyReasonTexts
      : appReasonTexts({
          ...storyModules,
          tableName: (table) => testTableName(table) ?? storyModules.tableName(table),
        }),
  );
  const storyAccess = useMemo(
    () => (answersTimers ? access : withNoTimerRunning(access)),
    [access, answersTimers],
  );
  return (
    <StoryTimeSettings {...time}>
      <DataProvider access={storyAccess} reasonTexts={reasonTexts}>
        <RouterProvider router={router} />
      </DataProvider>
    </StoryTimeSettings>
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

/** The drawer named `name` is closed; without a name, every drawer is. */
export const noDrawer = (name?: string) =>
  waitFor(() =>
    expect(screen.queryByRole("dialog", name === undefined ? {} : { name })).toBeNull(),
  );

/** A notice stays until the story answers it. Returns what lets the timers run again. */
export const keepNoticesOpen = () => holdTimers(8000).restore;

/** Undo on the latest notice, the one in front of the stack; the others lie behind it, inert. */
export async function undoLast() {
  const offers = await screen.findAllByRole("button", { name: "Undo" });
  await userEvent.click(offers.find((offer) => offer.closest("[inert]") === null)!);
}

/** The titles in the order the list named `name` shows them, without an emoji of a mark. */
export async function titlesShown(canvas: ReturnType<typeof within>, name: string) {
  return within(await canvas.findByRole("list", { name }))
    .getAllByRole("button")
    .map((row) => row.lastElementChild?.textContent);
}

/** Opens the entry from the list, so that there is a history entry to go back from. */
export async function editStudio(canvas: ReturnType<typeof within>) {
  await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
  const drawer = await screen.findByRole("dialog", { name: "Studio work" });
  const name = await within(drawer).findByRole("textbox", { name: "Name" });
  await userEvent.type(name, " changed");
  return { drawer: within(drawer), name };
}
