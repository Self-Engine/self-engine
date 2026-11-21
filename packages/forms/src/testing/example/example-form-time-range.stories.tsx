// The field "date, start, end" on an example form (D319, D344, D347), in Berlin, a zone with
// daylight saving time: on 25 October 2026 the clocks go back at 03:00, so 02:00–02:59 shows
// twice; on 28 March 2027 they jump from 02:00 to 03:00. The stories speak German, whose clock
// counts 24 hours, so a time is typed as four digits.

import { DataProvider } from "@self-engine/data-client/react";
import { type CalendarDay, calendarDaySchema } from "@self-engine/time";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { fieldsDrawnDuring } from "./fields-drawn.ts";
import { type Stretch, StretchForm, stretchContract } from "./stretch.tsx";
import { type RecordingPort, recordingPortOf } from "./story-port.ts";

const SAVED: Stretch = {
  id: "stretch-1",
  title: "Kitchen",
  started_at: "2026-11-13T08:00:50.000Z" as Stretch["started_at"],
  ended_at: "2026-11-13T16:30:10.000Z" as Stretch["ended_at"],
};

interface Loaded {
  readonly port: RecordingPort;
}

const portFor = (): Loaded => ({
  port: recordingPortOf(
    { stretch: stretchContract },
    { stretch: { create: { data: SAVED }, update: { data: SAVED } } },
  ),
});

interface Args {
  /** The stretch the form edits; without it, the form creates one. */
  readonly stored?: Stretch;
  /** The day a new stretch opens on. */
  readonly startDay?: CalendarDay;
}

const meta = {
  title: "Forms/Example form/Date, start, end",
  globals: { language: "de" },
  loaders: [portFor],
  render: (args: Args, { loaded }) => (
    <DataProvider access={(loaded as Loaded).port.access}>
      <StretchForm
        {...(args.stored === undefined ? {} : { stored: args.stored })}
        {...(args.startDay === undefined ? {} : { startDay: args.startDay })}
      />
    </DataProvider>
  ),
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;

const callsOf = (loaded: unknown) => (loaded as Loaded).port.calls;
const loadedRange = (started_at: string, ended_at: string): Args => ({
  stored: {
    ...SAVED,
    started_at: started_at as Stretch["started_at"],
    ended_at: ended_at as Stretch["ended_at"],
  },
});

function rangeIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const time = (name: string) => canvas.getByRole("spinbutton", { name });
  return {
    canvas,
    title: () => canvas.getByRole("textbox", { name: "Title" }),
    date: () => canvas.getByRole("textbox", { name: "Datum" }),
    endDate: () => canvas.getByRole("textbox", { name: "Enddatum" }),
    /** The hours of the start; the minutes follow them. */
    start: () => time("Beginn"),
    end: () => time("Ende"),
    save: () => userEvent.click(canvas.getByRole("button", { name: "Save" })),
  };
}

/** Types a time of four digits into the hours of a picker, over what it held. */
async function typeTime(hours: HTMLElement, digits: string) {
  await userEvent.click(hours);
  await userEvent.keyboard(digits);
  await userEvent.keyboard("{Escape}");
}

/** Types a day over what the date field held. */
async function typeDay(input: HTMLElement, text: string) {
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await userEvent.keyboard("{Escape}");
}

async function newRange(canvasElement: HTMLElement, day: string, start: string, end: string) {
  const range = rangeIn(canvasElement);
  await userEvent.type(range.title(), "Kitchen");
  await typeDay(range.date(), day);
  await typeTime(range.start(), start);
  await typeTime(range.end(), end);
  return range;
}

const created = (started_at: string, ended_at: string) => ({
  entry: "create",
  input: { title: "Kitchen", started_at, ended_at },
});

export const ANewRangeWritesTwoInstants: Story = {
  play: async ({ canvasElement, loaded }) => {
    const range = await newRange(canvasElement, "13.11.2026", "0900", "1730");
    await expect(range.canvas.getByText("Dauer: 8:30")).toBeVisible();
    await expect(range.canvas.queryByText("+1")).toBeNull();
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        created("2026-11-13T08:00:00.000Z", "2026-11-13T16:30:00.000Z"),
      ]),
    );
  },
};

export const ANewRangeOpensOnTheDayHandedIn: Story = {
  args: { startDay: calendarDaySchema.parse("2026-11-18") },
  play: async ({ canvasElement, loaded }) => {
    const range = rangeIn(canvasElement);
    await expect(range.date()).toHaveValue("18.11.2026");
    // The times stay empty: only the day is given.
    await expect(range.canvas.queryByText(/^Dauer/)).toBeNull();
    await userEvent.type(range.title(), "Kitchen");
    await typeTime(range.start(), "0900");
    await typeTime(range.end(), "1030");
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        created("2026-11-18T08:00:00.000Z", "2026-11-18T09:30:00.000Z"),
      ]),
    );
  },
};

export const AnEndNotAfterTheStartLiesOnTheNextDay: Story = {
  play: async ({ canvasElement, loaded }) => {
    const range = await newRange(canvasElement, "13.11.2026", "2200", "0130");
    await expect(range.canvas.getByText("+1")).toBeVisible();
    await expect(range.canvas.getByText("Dauer: 3:30")).toBeVisible();
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        created("2026-11-13T21:00:00.000Z", "2026-11-14T00:30:00.000Z"),
      ]),
    );
  },
};

export const AnOpenedEndDateTakesARangeOverSeveralDays: Story = {
  play: async ({ canvasElement, loaded }) => {
    const range = await newRange(canvasElement, "13.11.2026", "0900", "1700");
    await userEvent.click(range.canvas.getByRole("button", { name: "Enddatum hinzufügen" }));
    // The end date opens on the day the end lay on.
    await expect(range.endDate()).toHaveValue("13.11.2026");
    await typeDay(range.endDate(), "15.11.2026");
    await expect(range.canvas.getByText("Dauer: 56:00")).toBeVisible();
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        created("2026-11-13T08:00:00.000Z", "2026-11-15T16:00:00.000Z"),
      ]),
    );
  },
};

export const ALoadedRangeOverSeveralDaysShowsItsEndDate: Story = {
  args: loadedRange("2026-11-13T08:00:00.000Z", "2026-11-15T16:00:00.000Z"),
  play: async ({ canvasElement }) => {
    const range = rangeIn(canvasElement);
    await expect(range.date()).toHaveValue("13.11.2026");
    await expect(range.endDate()).toHaveValue("15.11.2026");
    await expect(range.start()).toHaveValue("09");
    await expect(range.end()).toHaveValue("17");
    await expect(range.canvas.queryByText("+1")).toBeNull();
  },
};

export const ALoadedOvernightRangeShowsPlusOne: Story = {
  args: loadedRange("2026-11-13T21:00:00.000Z", "2026-11-14T00:30:00.000Z"),
  play: async ({ canvasElement }) => {
    const range = rangeIn(canvasElement);
    await expect(range.canvas.getByText("+1")).toBeVisible();
    await expect(range.canvas.queryByRole("textbox", { name: "Enddatum" })).toBeNull();
  },
};

export const ChangingTheStartKeepsTheEndWithItsSeconds: Story = {
  args: { stored: SAVED },
  play: async ({ canvasElement, loaded }) => {
    const range = rangeIn(canvasElement);
    await typeTime(range.start(), "0930");
    await range.save();
    // The edit sends both, as they are tied; the end is the stored Instant with its seconds.
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        {
          entry: "update",
          input: {
            id: SAVED.id,
            started_at: "2026-11-13T08:30:00.000Z",
            ended_at: "2026-11-13T16:30:10.000Z",
          },
        },
      ]),
    );
  },
};

export const AnEndMovedByAPassingStartComesBackWithItsSeconds: Story = {
  args: loadedRange("2026-11-13T21:00:00.000Z", "2026-11-14T02:00:10.000Z"),
  play: async ({ canvasElement, loaded }) => {
    const range = rangeIn(canvasElement);
    // Typing 23:30 over 22:00 passes 02:00, before the end at 03:00 of the next day.
    await typeTime(range.start(), "2330");
    await expect(range.canvas.getByText("+1")).toBeVisible();
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        {
          entry: "update",
          input: {
            id: SAVED.id,
            started_at: "2026-11-13T22:30:00.000Z",
            ended_at: "2026-11-14T02:00:10.000Z",
          },
        },
      ]),
    );
  },
};

export const ChangingTheEndKeepsTheStartWithItsSeconds: Story = {
  args: { stored: SAVED },
  play: async ({ canvasElement, loaded }) => {
    const range = rangeIn(canvasElement);
    await typeTime(range.end(), "1800");
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        {
          entry: "update",
          input: {
            id: SAVED.id,
            started_at: "2026-11-13T08:00:50.000Z",
            ended_at: "2026-11-13T17:00:00.000Z",
          },
        },
      ]),
    );
  },
};

export const ARepeatedTimeIsNamedAtTheField: Story = {
  play: async ({ canvasElement, loaded }) => {
    // A new range from 01:30 to 02:30 on 25 October 2026 is one hour long: the end is the first
    // 02:30, an hour before UTC+1 begins.
    const range = await newRange(canvasElement, "25.10.2026", "0130", "0230");
    await expect(range.canvas.getByText("02:30 (UTC+2)")).toBeVisible();
    await expect(range.canvas.getByText("Dauer: 1:00")).toBeVisible();
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        created("2026-10-24T23:30:00.000Z", "2026-10-25T00:30:00.000Z"),
      ]),
    );
  },
};

export const ACorrectionInsideTheRepeatedHourStaysInIt: Story = {
  // A timer stopped at the second 02:40 of 25 October 2026.
  args: loadedRange("2026-10-25T00:10:00.000Z", "2026-10-25T01:40:30.000Z"),
  play: async ({ canvasElement, loaded }) => {
    const range = rangeIn(canvasElement);
    await expect(range.canvas.getByText("02:10 (UTC+2)")).toBeVisible();
    await expect(range.canvas.getByText("02:40 (UTC+1)")).toBeVisible();
    await expect(range.canvas.getByText("Dauer: 1:31")).toBeVisible();
    await typeTime(range.end(), "0245");
    await expect(range.canvas.getByText("02:45 (UTC+1)")).toBeVisible();
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        {
          entry: "update",
          input: {
            id: SAVED.id,
            started_at: "2026-10-25T00:10:00.000Z",
            ended_at: "2026-10-25T01:45:00.000Z",
          },
        },
      ]),
    );
  },
};

export const AnEarlierEndInTheRepeatedHourStaysOnTheStartDay: Story = {
  args: loadedRange("2026-10-25T00:10:00.000Z", "2026-10-25T01:40:30.000Z"),
  play: async ({ canvasElement, loaded }) => {
    const range = rangeIn(canvasElement);
    await expect(range.canvas.queryByRole("textbox", { name: "Enddatum" })).toBeNull();
    await typeTime(range.end(), "0205");
    await expect(range.end()).toHaveAccessibleDescription("02:05 (UTC+1)");
    await expect(range.canvas.getByText("Dauer: 0:55")).toBeVisible();
    await expect(range.canvas.queryByText("+1")).toBeNull();
    await userEvent.click(range.canvas.getByRole("button", { name: "Enddatum hinzufügen" }));
    await expect(range.endDate()).toHaveValue("25.10.2026");
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        {
          entry: "update",
          input: {
            id: SAVED.id,
            started_at: "2026-10-25T00:10:00.000Z",
            ended_at: "2026-10-25T01:05:00.000Z",
          },
        },
      ]),
    );
  },
};

export const TheDurationIsTheTimeThatReallyPassed: Story = {
  play: async ({ canvasElement }) => {
    const range = await newRange(canvasElement, "25.10.2026", "0100", "0400");
    await expect(range.canvas.getByText("Dauer: 4:00")).toBeVisible();
    await typeDay(range.date(), "28.03.2027");
    await expect(range.canvas.getByText("Dauer: 2:00")).toBeVisible();
  },
};

const SKIPPED =
  "Diese Uhrzeit gibt es an diesem Tag nicht: Die Uhren überspringen sie. Wähle eine andere.";

export const ASkippedTimeBlocksTheSave: Story = {
  play: async ({ canvasElement, loaded }) => {
    const range = await newRange(canvasElement, "28.03.2027", "0230", "0400");
    await range.save();
    await expect(range.start()).toHaveAccessibleDescription(SKIPPED);
    await expect(callsOf(loaded)).toEqual([]);

    await typeTime(range.start(), "0130");
    await waitFor(() => expect(range.start()).not.toHaveAccessibleDescription(SKIPPED));
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        created("2027-03-28T00:30:00.000Z", "2027-03-28T02:00:00.000Z"),
      ]),
    );
  },
};

const END_BEFORE_START = "Das Ende muss nach dem Beginn liegen.";

export const TheRuleAcrossBothShowsAtTheEndUntilEitherChanges: Story = {
  play: async ({ canvasElement, loaded }) => {
    const range = await newRange(canvasElement, "13.11.2026", "0900", "1700");
    await userEvent.click(range.canvas.getByRole("button", { name: "Enddatum hinzufügen" }));
    await typeDay(range.endDate(), "12.11.2026");
    await range.save();
    await expect(range.end()).toHaveAccessibleDescription(END_BEFORE_START);
    await expect(callsOf(loaded)).toEqual([]);

    // Moving the start back answers the rule at the end.
    await typeDay(range.date(), "11.11.2026");
    await waitFor(() => expect(range.end()).not.toHaveAccessibleDescription(END_BEFORE_START));
    await range.save();
    await waitFor(() =>
      expect(callsOf(loaded)).toEqual([
        created("2026-11-11T08:00:00.000Z", "2026-11-12T16:00:00.000Z"),
      ]),
    );
  },
};

export const TheCalendarsMarkTheTodayHandedIn: Story = {
  play: async ({ canvasElement }) => {
    const range = rangeIn(canvasElement);
    await userEvent.click(range.date());
    const calendar = within(document.body);
    await waitFor(() => expect(calendar.getByText("Februar 2031")).toBeVisible());
    await expect(
      calendar.getByRole("button", { name: "Freitag, 14. Februar 2031" }),
    ).toHaveAttribute("data-today", "true");
    await expect(screen.queryAllByRole("button", { name: /November 2026/ })).toEqual([]);
  },
};

const RANGE_FIELDS = ["TextField", "TimeRangeField"] as const;

export const TypingElsewhereRedrawsTheRangeNot: Story = {
  args: { stored: SAVED },
  play: async ({ canvasElement }) => {
    const range = rangeIn(canvasElement);
    await expect(
      await fieldsDrawnDuring(RANGE_FIELDS, () => userEvent.type(range.title(), " and hall")),
    ).toEqual({ TextField: 0, TimeRangeField: 0 });
    // The range draws once for each time the picker hands on while "0930" is typed over 09:00:
    // 00:00, 09:00, 09:03 and 09:30. The end keeps its Instant; the title does not draw.
    await expect(
      await fieldsDrawnDuring(RANGE_FIELDS, () => typeTime(range.start(), "0930")),
    ).toEqual({ TextField: 0, TimeRangeField: 4 });
  },
};

/** The vertical middle of an element on the screen. */
const middleOf = (element: Element) => {
  const { top, height } = element.getBoundingClientRect();
  return top + height / 2;
};

/** Expects every element to sit at the vertical middle of the input box that holds `input`. */
async function expectLinedUpWith(input: HTMLElement, elements: readonly Element[]) {
  const box = input.closest(".mantine-Input-input");
  await expect(box).not.toBeNull();
  for (const element of elements)
    await expect(Math.abs(middleOf(element) - middleOf(box!))).toBeLessThanOrEqual(1);
}

/** "+1", the button for an end date, and the button that closes it line up with the inputs. */
async function partsBesideTheEndLineUp(canvasElement: HTMLElement) {
  const range = rangeIn(canvasElement);
  await expectLinedUpWith(range.end(), [
    range.canvas.getByText("+1"),
    range.canvas.getByRole("button", { name: "Enddatum hinzufügen" }),
  ]);
  await userEvent.click(range.canvas.getByRole("button", { name: "Enddatum hinzufügen" }));
  await expectLinedUpWith(range.endDate(), [
    range.canvas.getByRole("button", { name: "Enddatum entfernen" }),
  ]);
}

export const ThePartsBesideTheEndLineUpAtTheSmallestFontScale: Story = {
  globals: { fontScale: "87.5" },
  args: loadedRange("2026-11-13T21:00:00.000Z", "2026-11-14T00:30:00.000Z"),
  play: ({ canvasElement }) => partsBesideTheEndLineUp(canvasElement),
};

export const ThePartsBesideTheEndLineUpAtTheLargestFontScale: Story = {
  globals: { fontScale: "112.5" },
  args: loadedRange("2026-11-13T21:00:00.000Z", "2026-11-14T00:30:00.000Z"),
  play: ({ canvasElement }) => partsBesideTheEndLineUp(canvasElement),
};
