// The View "Week" of `time-tracking` in the whole app, over Fixed Answers (D255) and a fixed
// Clock. The Query of a Day Span answers from the stored sample entries for the span the View
// asks, grouped as the Data Process groups them; that the week follows a write through the Table
// Change alone is shown by the module's hook test over the real Data Process.

import { answersByMount } from "@self-engine/data-client/testing";
import { projectsAnswers } from "@self-engine/projects/testing";
import { settingChange } from "@self-engine/settings";
import { type Clock, type Instant, resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING, WEEK_START_SETTING } from "@self-engine/time/settings";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import {
  SAMPLE_WEEK,
  SAMPLE_WEEK_ENTRIES,
  type StoredTimeEntries,
  timeEntry,
  timeTrackingAnswers,
  type TimeTrackingStoryPort,
  timeTrackingStoryPort,
} from "@self-engine/time-tracking/testing";
import {
  afterTheCommitsNowDue,
  commitWhere,
  difference,
  renderCounts,
} from "@self-engine/ui/story-render-counts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AppAt, loadStoryApp, type StoryTime, storyRouter } from "./story-app.tsx";
import { settingsStore } from "./settings-store.ts";

type Canvas = ReturnType<typeof within>;

const WEEK = "/time-tracking/week";
const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
const LOS_ANGELES = resolveTimeZone("America/Los_Angeles").timeZone;

/** Friday 20 November 2026, 11:00 in Berlin: the stories' fixed "now". */
const FRIDAY_MORNING = fixedClock(requireInstant("2026-11-20T10:00:00.000Z"));

/** Berlin time with Monday as the first day of the week: the region of German. */
const IN_BERLIN = { clock: FRIDAY_MORNING, deviceZone: BERLIN, region: "de-DE" } as const;

/** The Time Zone and week start follow the device and the region, whatever a story stored. */
async function loadWeekStory() {
  await loadStoryApp();
  settingsStore.writeAll([
    settingChange(TIME_ZONE_SETTING, TIME_ZONE_SETTING.default),
    settingChange(WEEK_START_SETTING, WEEK_START_SETTING.default),
  ]);
}

interface WeekStoryArgs {
  readonly address: string;
  /** The page's Clock, device zone and region; the stored entries' zone is the device's. */
  readonly time: Required<StoryTime>;
  readonly stored: StoredTimeEntries;
}

const meta = {
  title: "App/Time Tracking/Week",
  parameters: { layout: "fullscreen" },
  loaders: [loadWeekStory],
  args: { address: WEEK, time: IN_BERLIN, stored: { entries: SAMPLE_WEEK_ENTRIES } },
  render: ({ address, time, stored }) => (
    <AppAt
      access={answersByMount({
        timeTracking: timeTrackingAnswers({ timeZone: time.deviceZone, ...stored }),
        projects: projectsAnswers(),
      })}
      address={address}
      time={time}
    />
  ),
} satisfies Meta<WeekStoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The heading of the shown week. */
const heading = (canvas: Canvas, name: string) => canvas.findByRole("heading", { name });

/** The section of one day, named by its date read out in full. */
const day = (canvas: Canvas, name: string) => canvas.findByRole("region", { name });

/** The days in order, each with its sum. */
async function dayTotals(canvas: Canvas) {
  const days = within(await canvas.findByLabelText("Days of the week")).getAllByRole("region");
  return days.map((section) => within(section).getByLabelText("Day total").textContent);
}

/** The text of an element with every run of space as one space, such as Intl's before "AM". */
const textOf = (element: Element) => (element.textContent ?? "").replaceAll(/\s+/g, " ");

/** The rows of a day, each as its text. */
async function rowsOf(canvas: Canvas, name: string) {
  const section = await day(canvas, name);
  return within(section).queryAllByRole("listitem").map(textOf);
}

/** The day highlighted as today. */
async function today(canvas: Canvas) {
  const days = within(await canvas.findByLabelText("Days of the week")).getAllByRole("region");
  return days
    .filter((section) => section.getAttribute("aria-current") === "date")
    .map((section) => section.getAttribute("aria-label"));
}

/** The lines of the week's sums per project, each as its text. */
async function projectSums(canvas: Canvas) {
  const sums = await canvas.findByRole("region", { name: "Week totals" });
  return within(sums).getAllByRole("listitem").map(textOf);
}

/** The week the address holds. */
const weekInAddress = () =>
  (storyRouter().state.location.search as { readonly week?: unknown }).week;

export const TimeInTheNavbarOpensTheWeekOfToday: Story = {
  args: { address: "/projects/active" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("link", { name: "Time" }));

    await heading(canvas, "Mon, Nov 16 – Sun, Nov 22");
    await expect(await today(canvas)).toEqual(["Friday, November 20, 2026"]);
    await expect(weekInAddress()).toBeUndefined();
  },
};

export const WithSundayAsTheFirstDayTheSameDayLiesInAnotherWeek: Story = {
  args: { time: { ...IN_BERLIN, region: "en-US" } },
  play: async ({ canvas }) => {
    await heading(canvas, "Sun, Nov 15 – Sat, Nov 21");
    await expect(await today(canvas)).toEqual(["Friday, November 20, 2026"]);
    // Sunday 22 lies in the next week now; Monday's entries still count.
    await expect(await dayTotals(canvas)).toEqual([
      "0:00",
      "4:45",
      "3:00",
      "1:04:20",
      "2:00",
      "2:30",
      "0:00",
    ]);
  },
};

export const AFullWeekShowsEachDayWithItsEntriesAndTheSumsBeside: Story = {
  play: async ({ canvas }) => {
    await expect(await dayTotals(canvas)).toEqual([
      "4:45",
      "3:00",
      "1:04:20",
      "2:00",
      "2:30",
      "0:00",
      "0:00",
    ]);
    // Sorted by start: time, project, note and the Day Share.
    await expect(await rowsOf(canvas, "Monday, November 16, 2026")).toEqual([
      "8:00 AM – 11:30 AMWebsiteLanding page3:30",
      "1:00 PM – 2:15 PMNo projectEmails1:15",
    ]);
    // The two displayed durations add up to the displayed day total of 1:04:20.
    await expect(await rowsOf(canvas, "Wednesday, November 18, 2026")).toEqual([
      "9:30 AM – 10:14 AMWebsiteReview0:44:10",
      "10:30 AM – 10:50 AMWebsiteFixes0:20:10",
    ]);
    // The project sums add up to 13:19:20, with the largest first and "No project" last.
    await expect(await projectSums(canvas)).toEqual([
      "Website8:04:20",
      "🌱Garden3:00",
      "Old site1:00",
      "No project1:15",
    ]);
    await expect(canvas.getByLabelText("Week total")).toHaveTextContent("13:19:20");
  },
};

export const AnEntryAcrossMidnightLiesOnBothDaysWithItsShareAndAMark: Story = {
  args: {
    stored: {
      entries: [
        timeEntry(6, {
          startedAt: "2026-11-19T21:00:10.000Z",
          endedAt: "2026-11-20T00:30:10.000Z",
          project: SAMPLE_WEEK.release.projects[0]?.project ?? null,
          note: "Release",
        }),
        SAMPLE_WEEK.handover,
      ],
    },
  },
  play: async ({ canvas }) => {
    // Measured from 22:00:10 to 01:30:10, it counts from 22:00 to 01:30 under the default rule.
    await expect(await rowsOf(canvas, "Thursday, November 19, 2026")).toEqual([
      "10:00 PM – 1:30 AMWebsiteRelease2:00",
    ]);
    await expect(await rowsOf(canvas, "Friday, November 20, 2026")).toEqual([
      "10:00 PM – 1:30 AMWebsiteRelease1:30",
      "9:00 AM – 10:00 AMOld siteHandover1:00",
    ]);
    await expect(await projectSums(canvas)).toEqual(["Website3:30", "Old site1:00"]);
    for (const name of ["Thursday, November 19, 2026", "Friday, November 20, 2026"]) {
      const [release, handover] = within(await day(canvas, name)).getAllByRole("listitem");
      await expect(within(release!).getByRole("img", { name: "Crosses midnight" })).toBeVisible();
      if (handover !== undefined) {
        await expect(within(handover).queryByRole("img", { name: "Crosses midnight" })).toBeNull();
      }
    }
  },
};

export const AnEntryShowsItsRoundedTimeAndCountsItsBookedDuration: Story = {
  args: {
    stored: {
      entries: [
        // The rounding resolution's timer: 10:07:30 to 10:29:50 in Berlin.
        timeEntry(8, {
          startedAt: "2026-11-18T09:07:30.000Z",
          endedAt: "2026-11-18T09:29:50.000Z",
          note: "Timer",
        }),
      ],
    },
  },
  play: async ({ canvas }) => {
    // The default rule rounds 22:20 up to 0:23, from 10:07 to 10:30.
    await expect(await rowsOf(canvas, "Wednesday, November 18, 2026")).toEqual([
      "10:07 AM – 10:30 AMNo projectTimer0:23",
    ]);
    await expect(canvas.getByLabelText("Week total")).toHaveTextContent("0:23");
  },
};

export const OverlappingEntriesShowAHintAndCountInFull: Story = {
  args: {
    stored: {
      entries: [
        timeEntry(1, {
          startedAt: "2026-11-16T08:00:00.000Z",
          endedAt: "2026-11-16T10:00:00.000Z",
          note: "Design",
        }),
        timeEntry(2, {
          startedAt: "2026-11-16T09:00:00.000Z",
          endedAt: "2026-11-16T11:00:00.000Z",
          note: "Review",
        }),
        timeEntry(3, {
          startedAt: "2026-11-16T11:00:00.000Z",
          endedAt: "2026-11-16T12:00:00.000Z",
          note: "Handover",
        }),
      ],
    },
  },
  play: async ({ canvas }) => {
    const monday = within(await day(canvas, "Monday, November 16, 2026"));
    for (const note of ["Design", "Review"]) {
      const entry = await monday.findByRole("button", { name: new RegExp(note) });
      await expect(
        within(entry).getByRole("img", { name: "Overlaps another entry" }),
      ).toBeVisible();
      await expect(entry).toHaveAccessibleName(/Overlaps another entry/);
    }
    const handover = monday.getByRole("button", { name: /Handover/ });
    await expect(
      within(handover).queryByRole("img", { name: "Overlaps another entry" }),
    ).toBeNull();
    await expect(monday.getByLabelText("Day total")).toHaveTextContent("5:00");
    await expect(canvas.getByLabelText("Week total")).toHaveTextContent("5:00");
  },
};

export const AnArchivedProjectKeepsItsMark: Story = {
  play: async ({ canvas }) => {
    const [, handover] = within(await day(canvas, "Friday, November 20, 2026")).getAllByRole(
      "listitem",
    );
    const title = within(handover!).getByText("Old site");
    // The mark stands before the title: the house of the archived project, in its color.
    const mark = title.previousElementSibling;
    await expect(mark?.querySelector("svg")).toBeInstanceOf(SVGElement);
    await expect(projectSums(canvas)).resolves.toContain("Old site1:00");
  },
};

export const AnEmptyWeekShowsItsSevenDaysWithZero: Story = {
  args: { stored: { entries: [] } },
  play: async ({ canvas }) => {
    await expect(await dayTotals(canvas)).toEqual(Array.from({ length: 7 }, () => "0:00"));
    await expect(await rowsOf(canvas, "Monday, November 16, 2026")).toEqual([]);
    await expect(
      within(await canvas.findByRole("region", { name: "Week totals" })).queryAllByRole("listitem"),
    ).toEqual([]);
    await expect(canvas.getByLabelText("Week total")).toHaveTextContent("0:00");
  },
};

export const PreviousNextAndTodayChangeTheWeekInTheAddress: Story = {
  play: async ({ canvas }) => {
    await heading(canvas, "Mon, Nov 16 – Sun, Nov 22");
    await expect(canvas.getByRole("button", { name: "Today" })).toBeDisabled();

    await userEvent.click(canvas.getByRole("button", { name: "Next week" }));
    await heading(canvas, "Mon, Nov 23 – Sun, Nov 29");
    await expect(weekInAddress()).toBe("2026-11-23");
    await expect(await today(canvas)).toEqual([]);
    await expect(await dayTotals(canvas)).toEqual(Array.from({ length: 7 }, () => "0:00"));

    await userEvent.click(canvas.getByRole("button", { name: "Previous week" }));
    await userEvent.click(canvas.getByRole("button", { name: "Previous week" }));
    await heading(canvas, "Mon, Nov 9 – Sun, Nov 15");
    await expect(weekInAddress()).toBe("2026-11-09");

    await userEvent.click(canvas.getByRole("button", { name: "Today" }));
    await heading(canvas, "Mon, Nov 16 – Sun, Nov 22");
    // The week of today leaves the address, so that it follows "today".
    await expect(weekInAddress()).toBeUndefined();
    await expect(await today(canvas)).toEqual(["Friday, November 20, 2026"]);
  },
};

export const AReloadOrADeepLinkShowsTheWeekOfTheAddress: Story = {
  args: { address: `${WEEK}?week=2026-11-09` },
  play: async ({ canvas }) => {
    await heading(canvas, "Mon, Nov 9 – Sun, Nov 15");
    await expect(await today(canvas)).toEqual([]);
    await expect(canvas.getByRole("button", { name: "Today" })).toBeEnabled();
  },
};

/** A Clock the story moves, as time passes while the View stays open. */
function movingClock(start: string) {
  let now: Instant = requireInstant(start);
  const clock: Clock = () => now;
  return {
    clock,
    moveTo: (instant: string) => {
      now = requireInstant(instant);
    },
  };
}

const lateFriday = movingClock("2026-11-20T22:59:59.900Z");

export const TheHighlightMovesAtMidnight: Story = {
  args: { time: { ...IN_BERLIN, clock: lateFriday.clock } },
  // Before the render, so that a second run starts before midnight again.
  loaders: [() => lateFriday.moveTo("2026-11-20T22:59:59.900Z")],
  play: async ({ canvas }) => {
    await expect(await today(canvas)).toEqual(["Friday, November 20, 2026"]);

    lateFriday.moveTo("2026-11-20T23:00:01.000Z");

    // The page clock wakes at midnight, without a reload.
    await waitFor(
      async () => expect(await today(canvas)).toEqual(["Saturday, November 21, 2026"]),
      {
        timeout: 4000,
      },
    );
    await expect(weekInAddress()).toBeUndefined();
  },
};

const lateSunday = movingClock("2026-11-22T22:59:59.900Z");

export const AtTheEndOfTheWeekTheViewFollowsTodayIntoTheNext: Story = {
  args: { time: { ...IN_BERLIN, clock: lateSunday.clock } },
  loaders: [() => lateSunday.moveTo("2026-11-22T22:59:59.900Z")],
  play: async ({ canvas }) => {
    await heading(canvas, "Mon, Nov 16 – Sun, Nov 22");

    lateSunday.moveTo("2026-11-22T23:00:01.000Z");

    await heading(canvas, "Mon, Nov 23 – Sun, Nov 29");
    await waitFor(async () => expect(await today(canvas)).toEqual(["Monday, November 23, 2026"]), {
      timeout: 4000,
    });
  },
};

const sundayBeforeTheNamedWeek = movingClock("2026-11-22T22:59:59.900Z");

export const AWeekOpenedAheadFollowsTodayOnceItIsTheWeekOfToday: Story = {
  args: {
    address: `${WEEK}?week=2026-11-23`,
    time: { ...IN_BERLIN, clock: sundayBeforeTheNamedWeek.clock },
  },
  loaders: [() => sundayBeforeTheNamedWeek.moveTo("2026-11-22T22:59:59.900Z")],
  play: async ({ canvas }) => {
    await heading(canvas, "Mon, Nov 23 – Sun, Nov 29");
    await expect(weekInAddress()).toBe("2026-11-23");
    await expect(canvas.getByRole("button", { name: "Today" })).toBeEnabled();

    sundayBeforeTheNamedWeek.moveTo("2026-11-22T23:00:01.000Z");

    // The named week is now the week of today and leaves the address, as if reached with "Today".
    await waitFor(async () => expect(weekInAddress()).toBeUndefined(), { timeout: 4000 });
    await heading(canvas, "Mon, Nov 23 – Sun, Nov 29");
    await expect(await today(canvas)).toEqual(["Monday, November 23, 2026"]);
    await expect(canvas.getByRole("button", { name: "Today" })).toBeDisabled();
  },
};

export const ADeepLinkToTheWeekOfTodayFollowsToday: Story = {
  args: { address: `${WEEK}?week=2026-11-16` },
  play: async ({ canvas }) => {
    await heading(canvas, "Mon, Nov 16 – Sun, Nov 22");
    await waitFor(async () => expect(weekInAddress()).toBeUndefined());
  },
};

export const WestOfUtcTheSameEntriesFallOnOtherDays: Story = {
  args: {
    time: { clock: FRIDAY_MORNING, deviceZone: LOS_ANGELES, region: "de-DE" },
  },
  play: async ({ canvas }) => {
    // 02:00 on Friday in Los Angeles.
    await expect(await today(canvas)).toEqual(["Friday, November 20, 2026"]);
    // Thursday 13:00 to 16:30 there: one day, no mark.
    await expect(await rowsOf(canvas, "Thursday, November 19, 2026")).toEqual([
      "1:00 PM – 4:30 PMWebsiteRelease3:30",
    ]);
    // Sunday 23:00 to Monday 02:30: the week counts only Monday's part.
    const [landingPage] = within(await day(canvas, "Monday, November 16, 2026")).getAllByRole(
      "listitem",
    );
    await expect(textOf(landingPage!)).toBe("11:00 PM – 2:30 AMWebsiteLanding page2:30");
    await expect(within(landingPage!).getByRole("img", { name: "Crosses midnight" })).toBeVisible();
    await expect(canvas.getByLabelText("Week total")).toHaveTextContent("12:19:20");
  },
};

/** Saturday 10:00 to 12:00 in Berlin: the one entry another window adds. */
const SATURDAY = timeEntry(20, {
  startedAt: "2026-11-21T09:00:00.000Z",
  endedAt: "2026-11-21T11:00:00.000Z",
  note: "Weekend fix",
});

export const AnEntryAddedElsewhereRedrawsOneDayAndOneRow: Story = {
  // A new Port for every render, so that a second run starts before the change again.
  loaders: [() => ({ port: timeTrackingStoryPort({ entries: SAMPLE_WEEK_ENTRIES }) })],
  render: ({ address, time }, { loaded }) => {
    const port = loaded["port"] as TimeTrackingStoryPort;
    const projects = projectsAnswers();
    const access = {
      ...port.access,
      call: (module, entry, input, signal) =>
        (module === "projects" ? projects : port.access).call(module, entry, input, signal),
      describeEntry: (module, entry) =>
        (module === "projects" ? projects : port.access).describeEntry(module, entry),
    } satisfies TimeTrackingStoryPort["access"];
    return <AppAt access={access} address={address} time={time} />;
  },
  play: async ({ canvas, canvasElement, loaded }) => {
    const port = loaded["port"] as TimeTrackingStoryPort;
    const shows = (note: string) => canvasElement.textContent?.includes(note) ?? false;
    await canvas.findByText("Handover");
    await afterTheCommitsNowDue();
    const before = renderCounts();

    port.change({ entries: [...SAMPLE_WEEK_ENTRIES, SATURDAY] });
    await commitWhere(() => shows("Weekend fix"));
    await afterTheCommitsNowDue();

    const drawn = difference(renderCounts(), before).components;
    await expect({
      WeekDay: drawn["WeekDay"] ?? 0,
      DayEntryRow: drawn["DayEntryRow"] ?? 0,
    }).toEqual({ WeekDay: 1, DayEntryRow: 1 });
    await expect(await rowsOf(canvas, "Saturday, November 21, 2026")).toEqual([
      "10:00 AM – 12:00 PMNo projectWeekend fix2:00",
    ]);
  },
};
