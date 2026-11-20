// Shared by the package's Stories. Not a story file, so the Catalog does not list it.

import { DataProvider, NO_DATA_PROCESS, type PortAccess } from "@self-engine/data-client/react";
import type { SettingsStore } from "@self-engine/settings";
import { type Clock, type Region, resolveTimeZone, type TimeZone } from "@self-engine/time";
import { TimeSettingsProvider } from "@self-engine/time/react";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import { type ComponentType, useState } from "react";
import { SettingsPage } from "./area.tsx";
import {
  createSettingsArea,
  type SettingsRow,
  type NamedCommandOwner,
  type VersionInfo,
} from "./index.ts";
import { settingsRows } from "./rows.tsx";

const STORY_VERSION: VersionInfo = { version: "0.0.1", operatingSystem: "macOS" };

/** The device's zone in a story, which the Time Zone shows while none is set. */
export const STORY_DEVICE_ZONE = resolveTimeZone("Europe/Berlin").timeZone;

/** "Now" in a story: in winter, so Berlin is at UTC+1. */
export const STORY_CLOCK = fixedClock(requireInstant("2026-11-20T10:00:00.000Z"));

const throwError = (error: Error) => {
  throw error;
};

interface StoryPageOptions {
  readonly store: SettingsStore;
  readonly version?: VersionInfo;
  /** The Command owners whose Shortcuts are listed; none unless the story brings some. */
  readonly commandOwners?: readonly NamedCommandOwner[];
  /** Other rows than the real list. */
  readonly rows?: readonly SettingsRow[];
  /**
   * What the rows of the View Data read and call: the Fixed Answers of a story that shows them.
   * Without it no Data Process answers, as in a story about another View.
   */
  readonly access?: PortAccess;
  readonly deviceZone?: TimeZone;
  /** The region of the App Language, which an "Automatic" week start follows. */
  readonly region?: Region;
  readonly clock?: Clock;
}

/**
 * The page of a View without the Shell around it: the search text lives in the story, where the
 * app keeps it in the address. The app's stories show the address.
 */
export function storyViewPage(
  view: string,
  {
    store,
    version = STORY_VERSION,
    commandOwners = [],
    clock = STORY_CLOCK,
    rows = settingsRows({ version, commandOwners, clock }),
    access = NO_DATA_PROCESS,
    deviceZone = STORY_DEVICE_ZONE,
    region = "en-US",
  }: StoryPageOptions,
): ComponentType {
  const { views } = createSettingsArea({
    store,
    version: () => version,
    commandOwners: () => commandOwners,
    clock,
  });
  return function StoryViewPage() {
    const [search, setSearch] = useState("");
    return (
      <TimeSettingsProvider
        deviceZone={deviceZone}
        onError={throwError}
        region={region}
        store={store}
      >
        <DataProvider access={access}>
          <SettingsPage
            onSearch={setSearch}
            rows={rows}
            search={search}
            store={store}
            view={view}
            views={views}
          />
        </DataProvider>
      </TimeSettingsProvider>
    );
  };
}
