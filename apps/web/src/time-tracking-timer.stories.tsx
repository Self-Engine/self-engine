// The timer's Module Indicator in the whole app (#349), over Fixed Answers (D255) and a fixed
// Clock: on every page, running, idle and with a count, in its full form on the wide and medium
// Layout Step and its short form on the narrow step and the phone (D357); the Notices of a stop
// and of a start; and the render count of a tick. That the indicator follows each Operation
// through the Table Change alone is shown by the module's tests over the real Data Process.

import { answersByMount } from "@self-engine/data-client/testing";
import type { PortAccess } from "@self-engine/data-client/react";
import { projectReference, projectsAnswers, WEBSITE } from "@self-engine/projects/testing";
import { SHELL_REFERENCE_WIDTHS } from "@self-engine/shell/geometry";
import type { Clock } from "@self-engine/time";
import { advanceInstantByMilliseconds, requireInstant } from "@self-engine/time/testing";
import {
  runningTimer,
  sampleTimeEntryId,
  type StoredTimeEntries,
  type TimeTrackingAnswers,
  type TimeTrackingCall,
  type TimeTrackingStoryPort,
  timeTrackingStoryPort,
} from "@self-engine/time-tracking/testing";
import {
  afterTheCommitsNowDue,
  commitWhere,
  difference,
  renderCounts,
  rendersOutside,
} from "@self-engine/ui/story-render-counts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, screen, userEvent, waitFor, within } from "storybook/test";
import { clearNotices } from "@self-engine/ui/story-notices";
import {
  AppAt,
  keepNoticesOpen,
  loadStoryApp,
  openPalette,
  paletteGone,
  pressWithMod,
  storyRouter,
  type StoryTime,
} from "./story-app.tsx";

const viewport = (name: string, width: number) => ({
  name,
  styles: { width: `${width}px`, height: "800px" },
});
const VIEWPORTS = {
  wide: viewport("Wide", SHELL_REFERENCE_WIDTHS.wide),
  medium: viewport("Medium", SHELL_REFERENCE_WIDTHS.medium),
  narrow: viewport("Narrow", SHELL_REFERENCE_WIDTHS.narrow),
  phone: viewport("Phone", 390),
};
type Step = keyof typeof VIEWPORTS;

/**
 * Started at 09:47:13 in Berlin, before the stories' "now" of 11:00 on Friday 20 November 2026:
 * as after a restart, the first render shows the whole running time.
 */
const RUNNING = runningTimer(1, {
  startedAt: "2026-11-20T08:47:13.000Z",
  project: projectReference(WEBSITE),
  note: "Landing page",
});
/** Started at 08:00 without a project, as a sync could bring it beside the running one. */
const EARLIER = runningTimer(2, { startedAt: "2026-11-20T07:00:00.000Z" });

const { project: _project, ...RUNNING_TIMER } = RUNNING;

let port = timeTrackingStoryPort();

/** Waits until the Notice with `text` has slid in. */
async function noticeShown(text: string) {
  const notice = await screen.findByText(text);
  await waitFor(() => expect(notice).toBeVisible());
}

/** A story of a Notice starts from an empty screen and keeps its Notices open. */
const cleanNotices = () => {
  clearNotices();
  return keepNoticesOpen();
};

interface TimerStoryArgs {
  readonly address: string;
  readonly stored: StoredTimeEntries;
  readonly answers?: TimeTrackingAnswers;
  /** Changes the stored timers after an Operation, as the Data Process would. */
  readonly afterCall?: (call: TimeTrackingCall, of: TimeTrackingStoryPort) => void;
  readonly time?: StoryTime;
}

/** The timers' Port beside the projects of the page; the Table Changes come from the timers'. */
function storyPort({ stored, answers, afterCall }: TimerStoryArgs): PortAccess {
  port = timeTrackingStoryPort(stored, answers, afterCall);
  const projects = answersByMount({ projects: projectsAnswers() });
  return {
    ...port.access,
    describeEntry: (module, entry) =>
      (module === "projects" ? projects : port.access).describeEntry(module, entry),
    call: (module, entry, input, signal) =>
      (module === "projects" ? projects : port.access).call(module, entry, input, signal),
  };
}

const meta = {
  title: "App/Time Tracking/Timer",
  parameters: { layout: "fullscreen", viewport: { options: VIEWPORTS } },
  globals: { viewport: { value: "wide", isRotated: false } },
  loaders: [loadStoryApp],
  args: { address: "/projects/active", stored: { timers: [RUNNING] } },
  render: (args) => (
    <AppAt
      access={storyPort(args)}
      address={args.address}
      answersTimers
      {...(args.time && { time: args.time })}
    />
  ),
} satisfies Meta<TimerStoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

/** The indicator's code arrives in an idle moment, which a busy test browser can put off. */
const ARRIVES = { timeout: 4000 };

const contentHeader = (canvas: Canvas) =>
  within(canvas.getByRole("heading", { level: 1 }).parentElement!.parentElement!);

/** The running time in the content header, once the indicator shows it. */
async function runningTime(canvas: Canvas) {
  await canvas.findByRole("heading", { level: 1 });
  return contentHeader(canvas).findByRole("timer", {}, ARRIVES);
}

const isFull = (step: Step) => step === "wide" || step === "medium";

const runningAt = (step: Step): Story => ({
  globals: { viewport: { value: step, isRotated: false } },
  play: async ({ canvas }) => {
    const time = await runningTime(canvas);
    await expect(time).toHaveTextContent("1:12:47");
    // Tabular numbers: each digit as wide as the next, so the time does not jitter.
    await expect(time).toHaveStyle({ fontVariantNumeric: "tabular-nums" });
    const header = contentHeader(canvas);
    await expect(header.getByRole("button", { name: "Stop timer" })).toBeVisible();
    if (isFull(step)) await expect(header.getByText("Website")).toBeVisible();
    else await expect(header.queryByText("Website")).toBeNull();
  },
});

export const RunningAtTheWideStep = runningAt("wide");
export const RunningAtTheMediumStep = runningAt("medium");
export const RunningAtTheNarrowStep = runningAt("narrow");
export const RunningOnThePhone = runningAt("phone");

const idleAt = (step: Step): Story => ({
  globals: { viewport: { value: step, isRotated: false } },
  args: { stored: {} },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { level: 1 });
    const start = await contentHeader(canvas).findByRole(
      "button",
      { name: "Start timer" },
      ARRIVES,
    );
    // The full form names the offer; the short form shows its icon, named for a screen reader.
    await expect(start).toHaveTextContent(isFull(step) ? "Start timer" : "");
    await expect(contentHeader(canvas).queryByRole("timer")).toBeNull();
  },
});

export const IdleAtTheWideStep = idleAt("wide");
export const IdleOnThePhone = idleAt("phone");

const twoRunningAt = (step: Step): Story => ({
  globals: { viewport: { value: step, isRotated: false } },
  args: { stored: { timers: [EARLIER, RUNNING] } },
  play: async ({ canvas }) => {
    // The most recently started one, and how many run.
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");
    const count = contentHeader(canvas).getByRole("img", { name: "2 timers running" });
    await expect(count).toHaveTextContent("2");
    await expect(count).toBeVisible();
  },
});

export const TwoRunningAtTheWideStep = twoRunningAt("wide");
export const TwoRunningOnThePhone = twoRunningAt("phone");

/** Visible in every module, also in the settings, and in its own module. */
export const RunningInTheSettings: Story = {
  ...runningAt("wide"),
  args: { address: "/settings/appearance" },
};
export const RunningInItsOwnModule: Story = {
  ...runningAt("wide"),
  args: { address: "/time-tracking/week" },
};

/** When room is short the title shortens first; the time never does. */
export const ALongTitleShortensButTheTimeNever: Story = {
  args: {
    stored: {
      timers: [
        {
          ...RUNNING,
          project: { ...projectReference(WEBSITE), title: "Relaunch of the company website" },
        },
      ],
    },
  },
  play: async ({ canvas }) => {
    const time = await runningTime(canvas);
    const title = contentHeader(canvas).getByText("Relaunch of the company website");
    await waitFor(() => expect(title.scrollWidth).toBeGreaterThan(title.clientWidth));
    await expect(time.scrollWidth).toBeLessThanOrEqual(time.clientWidth);
    await expect(time).toHaveTextContent("1:12:47");
  },
};

/** The stored timers after a stop, and after an undo brought the timer back. */
const stopAndUndo = (call: TimeTrackingCall, of: TimeTrackingStoryPort) => {
  if (call.entry === "stopTimer") of.change({ timers: [] });
  if (call.entry === "undoStopTimer") of.change({ timers: [RUNNING] });
};

export const StoppingShowsANoticeWhoseUndoLetsTheTimerRunAgain: Story = {
  beforeEach: cleanNotices,
  args: { afterCall: stopAndUndo },
  play: async ({ canvas }) => {
    await runningTime(canvas);
    await userEvent.click(contentHeader(canvas).getByRole("button", { name: "Stop timer" }));
    await noticeShown("Time entry saved");
    await expect(
      await contentHeader(canvas).findByRole("button", { name: "Start timer" }),
    ).toBeVisible();

    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");
    await expect(port.calls).toEqual([
      { entry: "stopTimer", input: { id: RUNNING.id } },
      { entry: "undoStopTimer", input: { id: RUNNING.id } },
    ]);
  },
};

/** The middle of `element` on screen, where a click on it lands. */
function middleOf(element: Element) {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * The second click of a double click, 100 ms after the first, as the browser sends it: to
 * whatever now lies at the place of the first, counted as the series' second click (`detail`).
 */
async function secondClickAt({ x, y }: { readonly x: number; readonly y: number }) {
  const target = document.elementFromPoint(x, y);
  if (target === null) throw new Error("Nothing lies at the place of the first click");
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 2 };
  await fireEvent.mouseDown(target, init);
  await fireEvent.mouseUp(target, init);
  await fireEvent.click(target, init);
  await new Promise((resolve) => setTimeout(resolve, 100));
  return target;
}

/**
 * A double click on the stop button: the first click stops the timer, and the offer to start
 * appears in its place before the second click lands there. The second click starts nothing.
 */
const doubleClickOnStopAt = (step: Step): Story => ({
  globals: { viewport: { value: step, isRotated: false } },
  beforeEach: cleanNotices,
  args: { afterCall: stopAndUndo },
  play: async ({ canvas }) => {
    await runningTime(canvas);
    const header = contentHeader(canvas);
    const stop = header.getByRole("button", { name: "Stop timer" });
    const place = middleOf(stop);
    await userEvent.click(stop);
    const start = await header.findByRole("button", { name: "Start timer" });
    const hit = await secondClickAt(place);
    await expect(start.contains(hit)).toBe(true);
    await expect(port.calls).toEqual([{ entry: "stopTimer", input: { id: RUNNING.id } }]);
    await expect(header.queryByRole("timer")).toBeNull();
    await expect(start).toBeEnabled();
  },
});

export const ADoubleClickOnStopStartsNoTimerAtTheWideStep = doubleClickOnStopAt("wide");
export const ADoubleClickOnStopStartsNoTimerAtTheNarrowStep = doubleClickOnStopAt("narrow");

/**
 * A double click on the offer to start: the first click starts one timer, and the second, which
 * lands on what replaced the offer, neither starts another, nor stops this one, nor opens its
 * panel.
 */
const doubleClickOnStartAt = (step: Step): Story => ({
  globals: { viewport: { value: step, isRotated: false } },
  beforeEach: cleanNotices,
  args: {
    stored: {},
    answers: { startTimer: { data: { timer: RUNNING_TIMER, others: [] } } },
    afterCall(call, of) {
      if (call.entry === "startTimer") of.change({ timers: [RUNNING] });
      else stopAndUndo(call, of);
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { level: 1 });
    const header = contentHeader(canvas);
    const start = await header.findByRole("button", { name: "Start timer" }, ARRIVES);
    const place = middleOf(start);
    await userEvent.click(start);
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");
    await secondClickAt(place);
    await expect(port.calls).toEqual([{ entry: "startTimer", input: {} }]);
    await expect(header.getByRole("timer")).toBeVisible();
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
});

export const ADoubleClickOnStartStartsOneTimerAtTheWideStep = doubleClickOnStartAt("wide");
export const ADoubleClickOnStartStartsOneTimerAtTheNarrowStep = doubleClickOnStartAt("narrow");

export const StartAndStopFromAnotherModulesPalette: Story = {
  beforeEach: cleanNotices,
  args: {
    stored: {},
    answers: { startTimer: { data: { timer: RUNNING_TIMER, others: [] } } },
    afterCall(call, of) {
      if (call.entry === "startTimer") of.change({ timers: [RUNNING] });
      else stopAndUndo(call, of);
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Active", level: 1 });
    await openPalette();
    await userEvent.keyboard("start timer{Enter}");
    await paletteGone();
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");

    await openPalette();
    await userEvent.keyboard("stop timer{Enter}");
    await paletteGone();
    await noticeShown("Time entry saved");
    await expect(
      await contentHeader(canvas).findByRole("button", { name: "Start timer" }),
    ).toBeVisible();
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");
    await expect(storyRouter().state.location.pathname).toBe("/projects/active");
  },
};

export const StopFromThePaletteWhileIdleSaysThatNoTimerRuns: Story = {
  beforeEach: cleanNotices,
  args: { stored: {} },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Active", level: 1 });
    await openPalette();
    await userEvent.keyboard("stop timer{Enter}");
    await paletteGone();
    await noticeShown("No timer is running.");
    await expect(port.calls).toEqual([]);
    await expect(
      await contentHeader(canvas).findByRole("button", { name: "Start timer" }, ARRIVES),
    ).toBeVisible();
  },
};

export const TheShortcutStartsWhenIdleAndStopsTheLatestOfSeveral: Story = {
  beforeEach: cleanNotices,
  args: {
    stored: {},
    answers: { startTimer: { data: { timer: RUNNING_TIMER, others: [] } } },
    afterCall(call, of) {
      if (call.entry === "startTimer") of.change({ timers: [EARLIER, RUNNING] });
      if (
        call.entry === "stopTimer" &&
        typeof call.input === "object" &&
        call.input !== null &&
        "id" in call.input
      ) {
        of.change({ timers: [call.input.id === RUNNING.id ? EARLIER : RUNNING] });
      }
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Active", level: 1 });
    // Opening the palette also waits for the Shell's lazy Shortcut bindings.
    await openPalette();
    await userEvent.keyboard("{Escape}");
    await paletteGone();

    await pressWithMod("{Shift>}k{/Shift}");
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");
    await expect(
      contentHeader(canvas).getByRole("img", { name: "2 timers running" }),
    ).toBeVisible();

    await pressWithMod("{Shift>}k{/Shift}");
    await noticeShown("Time entry saved");
    await waitFor(() =>
      expect(contentHeader(canvas).getByRole("timer")).toHaveTextContent("3:00:00"),
    );
    await expect(storyRouter().state.location.pathname).toBe("/projects/active");
  },
};

export const AStopWithinTheSameSecondSaysThatNothingWasSaved: Story = {
  beforeEach: cleanNotices,
  args: {
    answers: { stopTimer: { data: { kind: "discarded", timer: RUNNING_TIMER } } },
    afterCall: stopAndUndo,
  },
  play: async ({ canvas }) => {
    await runningTime(canvas);
    await userEvent.click(contentHeader(canvas).getByRole("button", { name: "Stop timer" }));
    await noticeShown("Stopped within the same second: nothing was saved.");
    await expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  },
};

export const AStopWhileTheClockLiesBeforeTheStartSaysThatTheTimerKeepsRunning: Story = {
  beforeEach: cleanNotices,
  args: { answers: { stopTimer: { data: { kind: "clockBeforeStart", timer: RUNNING_TIMER } } } },
  play: async ({ canvas }) => {
    await runningTime(canvas);
    const stop = contentHeader(canvas).getByRole("button", { name: "Stop timer" });
    await userEvent.click(stop);
    await noticeShown("The clock shows a time before the timer's start. The timer keeps running.");
    // The timer runs on, and can be stopped again.
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");
    await waitFor(() => expect(stop).toBeEnabled());
  },
};

export const AStartThatStoppedAnotherTimerSaysThatItsEntryWasSaved: Story = {
  beforeEach: cleanNotices,
  args: {
    // A timer a sync brought, which the page had not shown yet, is stopped by the start.
    stored: {},
    answers: {
      startTimer: {
        data: {
          timer: RUNNING_TIMER,
          others: [
            {
              kind: "saved",
              entry: {
                id: sampleTimeEntryId(2),
                startedAt: EARLIER.startedAt,
                endedAt: "2026-11-20T10:00:00.000Z",
                durationSeconds: 10_800,
                projectId: null,
                note: null,
              },
            },
          ],
        },
      },
    },
    afterCall: (call, of) => {
      if (call.entry === "startTimer") of.change({ timers: [RUNNING] });
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { level: 1 });
    await userEvent.click(
      await contentHeader(canvas).findByRole("button", { name: "Start timer" }, ARRIVES),
    );
    await noticeShown("The running timer was stopped and its time entry saved.");
    await expect(await runningTime(canvas)).toHaveTextContent("1:12:47");
    await expect(port.calls).toEqual([{ entry: "startTimer", input: {} }]);
  },
};

/** The page's Clock of the render-count story, which the story moves by a second. */
let tickingNow = requireInstant("2026-11-20T10:00:00.000Z");
const tickingClock: Clock = () => tickingNow;

/** A tick redraws the running time and nothing else of the Shell (D348, D359). */
export const ATickRedrawsOnlyTheRunningTime: Story = {
  args: { time: { clock: tickingClock } },
  beforeEach: () => {
    tickingNow = requireInstant("2026-11-20T10:00:00.000Z");
  },
  play: async ({ canvas }) => {
    const time = await runningTime(canvas);
    await expect(time).toHaveTextContent("1:12:47");
    const tick = async (shown: string) => {
      tickingNow = advanceInstantByMilliseconds(tickingNow, 1000);
      await commitWhere(() => time.textContent === shown);
      await afterTheCommitsNowDue();
    };
    // A first tick lets the Shell's own idle work after the start finish, such as its warm-up.
    await tick("1:12:48");
    const before = renderCounts();

    const outside = await rendersOutside("RunningTime", () => tick("1:12:49"));
    await expect(difference(renderCounts(), before).components["RunningTime"]).toBe(1);
    await expect(outside).toEqual({});
  },
};
