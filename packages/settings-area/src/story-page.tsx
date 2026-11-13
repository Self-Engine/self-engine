// Shared by the package's Stories. Not a story file, so the Catalog does not list it.

import { DataProvider, NO_DATA_PROCESS, type PortAccess } from "@self-engine/data-client/react";
import type { SettingsStore } from "@self-engine/settings";
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
    rows = settingsRows({ version, commandOwners }),
    access = NO_DATA_PROCESS,
  }: StoryPageOptions,
): ComponentType {
  const { views } = createSettingsArea({
    store,
    version: () => version,
    commandOwners: () => commandOwners,
  });
  return function StoryViewPage() {
    const [search, setSearch] = useState("");
    return (
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
    );
  };
}
