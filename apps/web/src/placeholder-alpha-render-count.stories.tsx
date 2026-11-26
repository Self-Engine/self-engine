// The render-count gate (D256): renaming one of 1,000 entries redraws exactly one row and the list
// once. It draws the real Views of `placeholder-alpha` in the whole app. The number is fixed, not
// a share: a list whose rows break the row rule draws all 1,000 (docs/development/performance.md,
// "One changed row redraws one row").

import { changingAnswers } from "@self-engine/data-client/testing";
import { placeholderAlphaAnswers, sampleEntries } from "@self-engine/placeholder-alpha/testing";
import {
  afterTheCommitsNowDue,
  commitWhere,
  difference,
  renderCounts,
  rendersOutside,
} from "@self-engine/ui/story-render-counts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { closed, settled } from "@self-engine/ui/story-surfaces";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { AppAt, loadStoryApp } from "./story-app.tsx";

const ROWS = 1000;
const RENAMED = 500;
const ENTRIES = sampleEntries(ROWS);
const RENAMED_ENTRIES = ENTRIES.map((entry, index) =>
  index === RENAMED - 1 ? { ...entry, name: "Renamed entry" } : { ...entry },
);

/** What the Data Process's Query-to-tables list says about `placeholder-alpha` (D248). */
const QUERIES = { placeholderAlpha: { list: ["placeholder_alpha_entries"] } };

/**
 * A Port whose list answers 1,000 entries until the story delivers the Table Change of a rename,
 * and the same entries with one renamed after it. Both answers are Fixed Answers, checked against
 * the Contract; like the Data Process, the second answer hands every row over as a new object.
 */
function aRenameOfOneEntry() {
  const port = changingAnswers(placeholderAlphaAnswers({ list: { data: ENTRIES } }), QUERIES);
  const renamed = placeholderAlphaAnswers({ list: { data: RENAMED_ENTRIES } });
  const rename = () => port.change(renamed, ["placeholder_alpha_entries"]);
  return { access: port.access, rename };
}

const meta = {
  title: "App/Placeholder Alpha render count",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  // A new Port for every render, so that a second run starts before the rename again.
  loaders: [
    async () => {
      await loadStoryApp();
      return { port: aRenameOfOneEntry() };
    },
  ],
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

const VIEW_LIST_AND_ROW = ["Entries", "EntryList", "EntryRow"] as const;

/** The Edit Drawer on screen. A selector lookup, for the reason `shows` gives. */
const editDrawer = () => document.querySelector<HTMLElement>("[role=dialog]");

/**
 * Opening a row's Edit Drawer and closing it, with the focus back on the row, draws no row, not
 * the list and not the View: the row's mark for the focus is a constant attribute, and the Shell
 * looks it up only when the drawer closes (ADR 0041).
 */
export const OpeningAndClosingTheDrawerDrawsNoRow: Story = {
  play: async ({ canvasElement }) => {
    await commitWhere(() => shows(canvasElement, `Entry ${ROWS}`));
    await afterTheCommitsNowDue();
    const before = renderCounts();
    // Each was drawn, so a count of 0 below is not a name that matches nothing.
    for (const name of VIEW_LIST_AND_ROW) await expect(before.components[name]).toBeGreaterThan(0);

    const row = [...canvasElement.querySelectorAll("button")].find(
      (button) => button.textContent === `Entry ${RENAMED}`,
    )!;
    await userEvent.click(row);
    await commitWhere(() => editDrawer() !== null);
    const drawer = await settled(editDrawer()!);
    // The drawer's code arrives after the click, which takes a busy browser a while over 1,000 rows.
    await waitFor(() => expect(drawer).toHaveAccessibleName(`Entry ${RENAMED}`), { timeout: 4000 });
    await userEvent.keyboard("{Escape}");
    await closed(editDrawer);
    await expect(row).toHaveFocus();
    await afterTheCommitsNowDue();

    const drawn = difference(renderCounts(), before).components;
    await expect(
      Object.fromEntries(VIEW_LIST_AND_ROW.map((name) => [name, drawn[name] ?? 0])),
    ).toEqual({ Entries: 0, EntryList: 0, EntryRow: 0 });
  },
};

/**
 * Resolves once React has committed nothing for `quietMs`. Each Module Indicator shows as soon as
 * its own code has arrived (#297), so another module's indicator and the panels' frames draw their
 * places a moment after the first indicator is on screen.
 */
async function whenTheStartHasSettled(quietMs = 100, timeoutMs = 4000): Promise<void> {
  const until = performance.now() + timeoutMs;
  let commits = renderCounts().commits;
  while (performance.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, quietMs));
    await afterTheCommitsNowDue();
    const now = renderCounts().commits;
    if (now === commits) return;
    commits = now;
  }
  throw new Error(`React was still committing ${timeoutMs} ms after the start`);
}

export const AnIndicatorTickAndPanelTypingLeaveTheShellStill: Story = {
  args: { address: "/placeholder-beta/overview" },
  globals: { viewport: { value: "wide", isRotated: false } },
  play: async ({ canvas }) => {
    await canvas.findByText("The minimal module View.");
    // The indicator's code arrives in an idle moment, which a busy browser takes a while to find.
    const tick = await canvas.findByRole("button", { name: "Count up" }, { timeout: 4000 });
    await whenTheStartHasSettled();
    const beforeTick = renderCounts();

    const outsideIndicator = await rendersOutside("Indicator", async () => {
      // Drive the counter without moving the pointer or focus and redrawing a tooltip.
      tick.click();
      await commitWhere(() => canvas.queryByRole("button", { name: "Counted 1" }) !== null);
      await afterTheCommitsNowDue();
    });
    await expect(difference(renderCounts(), beforeTick).components["Indicator"]).toBe(1);
    await expect(outsideIndicator).toEqual({});

    await userEvent.click(canvas.getByRole("button", { name: "Counted 1" }));
    const panel = await settled(screen.findByRole("dialog", { name: "Placeholder Alpha" }));
    const field = await within(panel).findByRole("textbox", { name: "Note" });
    await userEvent.click(field);
    await expect(field).toHaveFocus();
    await afterTheCommitsNowDue();
    const outsidePanel = await rendersOutside("IndicatorPanelFrame", async () => {
      await userEvent.keyboard("A note");
      await expect(field).toHaveValue("A note");
      await afterTheCommitsNowDue();
    });
    await expect(outsidePanel).toEqual({});
  },
};
