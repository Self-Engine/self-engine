// The Edit Drawer of a time entry, opened from the week, over Fixed Answers (D255) and a fixed
// Clock (Friday 20 November 2026, 11:00 in Berlin). The stories speak German, whose clock counts
// 24 hours, so a time is typed as four digits. Each story asserts the calls that reach the Port;
// that the Data Process answers them as the Contract says is shown by the module's tests over the
// test Data Process.

import type { PortAccess } from "@self-engine/data-client/react";
import { answersByMount } from "@self-engine/data-client/testing";
import { projectsAnswers, WEBSITE } from "@self-engine/projects/testing";
import { settingChange } from "@self-engine/settings";
import { resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING, WEEK_START_SETTING } from "@self-engine/time/settings";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import {
  SAMPLE_WEEK,
  SAMPLE_WEEK_ENTRIES,
  type StoredTimeEntries,
  timeEntry,
  type TimeTrackingAnswers,
  type TimeTrackingCall,
  type TimeTrackingStoryPort,
  timeTrackingStoryPort,
  timeEntryAnswer,
} from "@self-engine/time-tracking/testing";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { settled } from "@self-engine/ui/story-surfaces";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { settingsStore } from "./settings-store.ts";
import { AppAt, keepNoticesOpen, loadStoryApp, noDrawer } from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
const IN_BERLIN = {
  clock: fixedClock(requireInstant("2026-11-20T10:00:00.000Z")),
  deviceZone: BERLIN,
  region: "de-DE",
} as const;

/** The Time Zone and week start follow the device and the region, whatever a story stored. */
async function loadEditStory() {
  await loadStoryApp();
  settingsStore.writeAll([
    settingChange(TIME_ZONE_SETTING, TIME_ZONE_SETTING.default),
    settingChange(WEEK_START_SETTING, WEEK_START_SETTING.default),
  ]);
}

let port = timeTrackingStoryPort();

/** The Port a story's render uses; `afterCall` changes the stored entries after an Operation. */
function storyPort(
  stored: StoredTimeEntries,
  answers: TimeTrackingAnswers = {},
  afterCall?: (call: TimeTrackingCall, of: TimeTrackingStoryPort) => void,
) {
  port = timeTrackingStoryPort(stored, answers, afterCall);
  // The picker's projects beside the entries; the Table Changes come from the entries' Port.
  const projects = answersByMount({ projects: projectsAnswers() });
  const access: PortAccess = {
    ...port.access,
    describeEntry: (module, entry) =>
      (module === "projects" ? projects : port.access).describeEntry(module, entry),
    call: (module, entry, input, signal) =>
      (module === "projects" ? projects : port.access).call(module, entry, input, signal),
  };
  return access;
}

interface EditStoryArgs {
  readonly stored: StoredTimeEntries;
  readonly answers?: TimeTrackingAnswers;
  readonly afterCall?: (call: TimeTrackingCall, of: TimeTrackingStoryPort) => void;
}

const meta = {
  title: "App/Time Tracking/Edit",
  parameters: { layout: "fullscreen" },
  globals: { language: "de" },
  loaders: [loadEditStory],
  args: { stored: { entries: SAMPLE_WEEK_ENTRIES } },
  render: ({ stored, answers, afterCall }) => (
    <AppAt
      access={storyPort(stored, answers, afterCall)}
      address="/time-tracking/week"
      time={IN_BERLIN}
    />
  ),
} satisfies Meta<EditStoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

const WEDNESDAY = "Mittwoch, 18. November 2026";

/** The section of one day, named by its date read out in full. */
const day = (canvas: Canvas, name: string) => canvas.findByRole("region", { name });

/** The drawer named `name` and its parts, as a user finds them. */
async function drawerNamed(name: string) {
  const dialog = await settled(screen.findByRole("dialog", { name }));
  const drawer = within(dialog);
  const time = (label: string) => drawer.getByRole("spinbutton", { name: label });
  // The drawer takes the focus once it is shown; keys typed before that would be lost.
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return {
    drawer,
    date: () => drawer.getByRole("textbox", { name: "Datum" }),
    endDate: () => drawer.getByRole("textbox", { name: "Enddatum" }),
    start: () => time("Beginn"),
    end: () => time("Ende"),
    note: () => drawer.getByRole("textbox", { name: "Notiz" }),
    project: () => drawer.getByLabelText("Projekt") as HTMLInputElement,
    save: () => drawer.getByRole("button", { name: "Speichern" }),
  };
}

/**
 * Types a time of four digits into the hours of a picker, over what it held. The list stays open
 * until the focus moves on: Esc is the drawer's here and would ask whether to discard (#377), and
 * that question takes the focus from whatever is typed next.
 */
async function typeTime(hours: HTMLElement, digits: string) {
  await userEvent.click(hours);
  await userEvent.keyboard(digits);
}

/** Types a day over what the date field held. No Esc after it, as in `typeTime`. */
async function typeDay(input: HTMLElement, text: string) {
  await userEvent.clear(input);
  await userEvent.type(input, text);
}

/** The hours and minutes of the start and of the end, as their inputs show them. */
const typedTimes = (form: Awaited<ReturnType<typeof drawerNamed>>) =>
  form.drawer.getAllByRole("spinbutton").map((input) => (input as HTMLInputElement).value);

/** Opens a new entry from the "New" of a day. */
async function newOn(canvas: Canvas, name: string) {
  const section = await day(canvas, name);
  await userEvent.click(
    within(section).getByRole("button", { name: `Neuer Zeiteintrag am ${name}` }),
  );
  return drawerNamed("Neuer Zeiteintrag");
}

/** Opens the row of a day whose text holds `note`. */
async function openRow(canvas: Canvas, name: string, note: string) {
  const section = await day(canvas, name);
  const row = within(section)
    .getAllByRole("button")
    .find((button) => button.textContent.includes(note));
  if (row === undefined) throw new Error(`No row ${note}`);
  await userEvent.click(row);
  return drawerNamed("Zeiteintrag");
}

/** Wednesday 14:00 to 15:30 in Berlin, as the create of the first story stores it. */
const CREATED = timeEntry(30, {
  startedAt: "2026-11-18T13:00:00.000Z",
  endedAt: "2026-11-18T14:30:00.000Z",
  note: "Call",
});

const CREATED_ANSWER = timeEntryAnswer(CREATED);

/** What has the focus, as a person would name it, for a failure that says where it went. */
function focused(): string {
  const element = document.activeElement;
  if (element === null || element === document.body) return "the page";
  return `${element.tagName.toLowerCase()} "${element.textContent}"`;
}

/** Its row takes the focus once the week shows it (ADR 0041). */
export const ANewEntryOpensOnTheClickedDayAndAppearsThere: Story = {
  args: {
    answers: { create: { data: CREATED_ANSWER } },
    afterCall: (call, of) => {
      if (call.entry === "create") of.change({ entries: [...SAMPLE_WEEK_ENTRIES, CREATED] });
    },
  },
  play: async ({ canvas }) => {
    const form = await newOn(canvas, WEDNESDAY);
    await expect(form.date()).toHaveValue("18.11.2026");
    // The times are empty, so there is no duration yet.
    await expect(form.drawer.queryByText(/^Dauer/)).toBeNull();
    await typeTime(form.start(), "1400");
    await typeTime(form.end(), "1530");
    // The duration follows while the user types, and is no field.
    await expect(typedTimes(form)).toEqual(["14", "00", "15", "30"]);
    await expect(await form.drawer.findByText("Dauer: 1:30")).toBeVisible();
    await expect(form.drawer.queryByRole("textbox", { name: /Dauer/ })).toBeNull();
    await userEvent.type(form.note(), "Call");
    await userEvent.click(form.save());

    await noDrawer();
    await expect(port.calls).toEqual([
      {
        entry: "create",
        input: {
          timeKind: "work",
          startedAt: "2026-11-18T13:00:00.000Z",
          endedAt: "2026-11-18T14:30:00.000Z",
          projects: [],
          note: "Call",
          ruleByHand: null,
          breaks: [],
        },
      },
    ]);
    await waitFor(async () => expect((await day(canvas, WEDNESDAY)).textContent).toContain("Call"));
    const row = within(await day(canvas, WEDNESDAY))
      .getAllByRole("button")
      .find((button) => button.textContent.includes("Call"));
    await waitFor(() => expect(row, `the focus is on ${focused()}`).toHaveFocus());
  },
};

export const AnEndTimeNotAfterTheStartLiesOnTheNextDay: Story = {
  play: async ({ canvas }) => {
    const form = await newOn(canvas, WEDNESDAY);
    await typeTime(form.start(), "2200");
    await typeTime(form.end(), "0130");
    await expect(typedTimes(form)).toEqual(["22", "00", "01", "30"]);
    await expect(await form.drawer.findByText("+1")).toBeVisible();
    await expect(await form.drawer.findByText("Dauer: 3:30")).toBeVisible();
    await userEvent.click(form.save());

    await noDrawer();
    await expect(port.calls).toEqual([
      {
        entry: "create",
        input: {
          timeKind: "work",
          startedAt: "2026-11-18T21:00:00.000Z",
          endedAt: "2026-11-19T00:30:00.000Z",
          projects: [],
          note: null,
          ruleByHand: null,
          breaks: [],
        },
      },
    ]);
  },
};

export const AStoredEntryOpensWithItsValuesAndSendsOnlyTheChangedNote: Story = {
  play: async ({ canvas }) => {
    const form = await openRow(canvas, WEDNESDAY, "Review");
    await expect(form.date()).toHaveValue("18.11.2026");
    await expect(form.start()).toHaveValue("09");
    await expect(form.end()).toHaveValue("10");
    await expect(form.drawer.getByText("Dauer: 0:44:10")).toBeVisible();
    await expect(form.project()).toHaveValue("Website");
    await expect(form.note()).toHaveValue("Review");
    await expect(form.save()).toBeDisabled();

    await userEvent.type(form.note(), " of the shop");
    await userEvent.click(form.save());

    await noDrawer();
    await expect(port.calls).toEqual([
      { entry: "edit", input: { id: SAMPLE_WEEK.review.id, note: "Review of the shop" } },
    ]);
  },
};

export const AnEndNotAfterTheStartShowsTheMessageAtTheEndAndBlocksTheSave: Story = {
  play: async ({ canvas }) => {
    const form = await openRow(canvas, WEDNESDAY, "Review");
    await userEvent.click(form.drawer.getByRole("button", { name: "Enddatum hinzufügen" }));
    await typeDay(form.endDate(), "17.11.2026");
    await userEvent.click(form.save());

    await expect(
      await form.drawer.findByText("Das Ende muss nach dem Beginn liegen."),
    ).toBeVisible();
    await expect(form.end()).toHaveAccessibleDescription(
      expect.stringContaining("Das Ende muss nach dem Beginn liegen."),
    );
    await expect(port.calls).toEqual([]);
  },
};

export const AnEntryOfAnArchivedProjectShowsItAndSaves: Story = {
  play: async ({ canvas }) => {
    const form = await openRow(canvas, "Freitag, 20. November 2026", "Handover");
    await expect(form.project()).toHaveValue("Old site (archiviert)");
    await userEvent.type(form.note(), "!");
    await userEvent.click(form.save());

    await noDrawer();
    await expect(port.calls).toEqual([
      { entry: "edit", input: { id: SAMPLE_WEEK.handover.id, note: "Handover!" } },
    ]);
  },
};

export const TheProjectCanBeCleared: Story = {
  play: async ({ canvas }) => {
    const form = await openRow(canvas, WEDNESDAY, "Review");
    await userEvent.click(form.drawer.getByRole("button", { name: "Auswahl leeren" }));
    await userEvent.click(form.save());

    await noDrawer();
    await expect(port.calls).toEqual([
      { entry: "edit", input: { id: SAMPLE_WEEK.review.id, projects: [] } },
    ]);
  },
};

export const ASaveToAProjectDeletedMeanwhileShowsTheRefusalAtTheProject: Story = {
  args: {
    answers: {
      edit: {
        refused: [
          {
            // The frame refuses the new share at its column.
            code: "target_deleted",
            table: "project_shares",
            row: "01a1cfa1-0f00-7000-8000-000000000001",
            field: "project_id",
            details: { target: { table: "projects", id: WEBSITE.id } },
          },
        ],
      },
    },
  },
  play: async ({ canvas }) => {
    const form = await openRow(canvas, "Montag, 16. November 2026", "Emails");
    await userEvent.click(form.project());
    await userEvent.click(await screen.findByRole("option", { name: "Website" }));
    await userEvent.click(form.save());

    const message = "Der verknüpfte Eintrag (Projekt) ist nicht mehr verfügbar.";
    await expect(await form.drawer.findByText(message)).toBeVisible();
    await expect(form.project()).toHaveAccessibleDescription(expect.stringContaining(message));
    // The field shows the Reason; no Notice repeats it.
    await expect(screen.queryByRole("alert")).toBeNull();
    await expect(port.calls).toEqual([
      {
        entry: "edit",
        input: { id: SAMPLE_WEEK.emails.id, projects: [{ projectId: WEBSITE.id }] },
      },
    ]);
  },
};

/**
 * The focus is on the week's fixed place once the row is gone (ADR 0041): the first control after
 * the project filter, whose list would open on the focus.
 */
export const DeleteShowsANoticeWhoseUndoBringsTheEntryBack: Story = {
  beforeEach: keepNoticesOpen,
  args: {
    afterCall: (call, of) => {
      const others = SAMPLE_WEEK_ENTRIES.filter((entry) => entry !== SAMPLE_WEEK.review);
      if (call.entry === "delete") of.change({ entries: others });
      if (call.entry === "restore") of.change({ entries: SAMPLE_WEEK_ENTRIES });
    },
  },
  play: async ({ canvas }) => {
    const form = await openRow(canvas, WEDNESDAY, "Review");
    await userEvent.click(form.drawer.getByRole("button", { name: "Löschen" }));

    await noDrawer();
    await expect(await screen.findByText("Zeiteintrag gelöscht")).toBeVisible();
    await waitFor(async () =>
      expect((await day(canvas, WEDNESDAY)).textContent).not.toContain("Review"),
    );
    // The row is gone: the focus is on the week's fixed place, and the filter's list stays closed.
    const previous = canvas.getByRole("button", { name: "Vorige Woche" });
    await waitFor(() => expect(previous, `the focus is on ${focused()}`).toHaveFocus());
    await expect(canvas.getByRole("combobox", { name: "Nach Projekt filtern" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(screen.queryByRole("listbox")).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Rückgängig" }));
    await waitFor(async () =>
      expect((await day(canvas, WEDNESDAY)).textContent).toContain("Review"),
    );
    await expect(port.calls).toEqual([
      { entry: "delete", input: { id: SAMPLE_WEEK.review.id } },
      { entry: "restore", input: { id: SAMPLE_WEEK.review.id } },
    ]);
  },
};
