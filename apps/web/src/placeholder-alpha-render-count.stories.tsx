// The render-count gate (D256): renaming one of 1,000 entries redraws exactly one row and the list
// once. It draws the real Views of `placeholder-alpha` in the whole app. The number is fixed, not
// a share: a list whose rows break the row rule draws all 1,000 (docs/development/performance.md,
// "One changed row redraws one row").

import type { PortAccess } from "@self-engine/data-client/react";
import { placeholderAlphaAnswers, sampleEntries } from "@self-engine/placeholder-alpha/testing";
import {
  afterTheCommitsNowDue,
  commitWhere,
  difference,
  renderCounts,
} from "@self-engine/ui/story-render-counts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { settingsStore } from "./settings-store.ts";
import { AppAt } from "./story-app.tsx";

const ROWS = 1000;
const RENAMED = 500;
const ENTRIES = sampleEntries(ROWS);
const RENAMED_ENTRIES = ENTRIES.map((entry, index) =>
  index === RENAMED - 1 ? { ...entry, name: "Renamed entry" } : { ...entry },
);

/** What the Data Process's Query-to-tables list says about the list (D248). */
const LIST_READS = { kind: "query", reads: ["placeholder_alpha_entries"] } as const;

/**
 * A Port whose list answers 1,000 entries until the story delivers the Table Change of a rename,
 * and the same entries with one renamed after it. Both answers are Fixed Answers, checked against
 * the Contract; like the Data Process, the second answer hands every row over as a new object.
 */
function aRenameOfOneEntry() {
  const listeners = new Set<(tables: string[]) => void>();
  let answers = placeholderAlphaAnswers({ list: { data: ENTRIES } });
  const renamed = placeholderAlphaAnswers({ list: { data: RENAMED_ENTRIES } });
  const access: PortAccess = {
    call: (module, entry, input, signal) => answers.call(module, entry, input, signal),
    describeEntry: (module, entry) =>
      module === "placeholderAlpha" && entry === "list" ? LIST_READS : undefined,
    onTablesChanged: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onReconnected: () => () => undefined,
  };
  const rename = () => {
    answers = renamed;
    for (const listener of listeners) listener(["placeholder_alpha_entries"]);
  };
  return { access, rename };
}

const meta = {
  title: "App/Placeholder Alpha render count",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  // A new Port for every render, so that a second run starts before the rename again.
  loaders: [async () => ({ port: aRenameOfOneEntry(), settings: await settingsStore.load() })],
  render: (args, { loaded }) => <AppAt {...args} access={loaded["port"].access} />,
  args: { address: "/placeholder-alpha/overview", access: placeholderAlphaAnswers() },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Whether the list shows a row by this name. A text lookup: role queries over 2,000 buttons are slow. */
const shows = (canvasElement: HTMLElement, name: string) =>
  [...canvasElement.querySelectorAll("button")].some((button) => button.textContent === name);

const LIST_AND_ROW = ["EntryList", "EntryRow"] as const;

export const RenamingOneOf1000EntriesRedrawsOneRow: Story = {
  play: async ({ canvasElement, loaded }) => {
    const port: ReturnType<typeof aRenameOfOneEntry> = loaded["port"];
    await commitWhere(() => shows(canvasElement, `Entry ${ROWS}`));
    await afterTheCommitsNowDue();
    const before = renderCounts();

    port.rename();
    await commitWhere(() => shows(canvasElement, "Renamed entry"));
    await afterTheCommitsNowDue();

    const drawn = difference(renderCounts(), before).components;
    await expect(shows(canvasElement, `Entry ${RENAMED}`)).toBe(false);
    await expect(Object.fromEntries(LIST_AND_ROW.map((name) => [name, drawn[name] ?? 0]))).toEqual({
      EntryList: 1,
      EntryRow: 1,
    });
  },
};
