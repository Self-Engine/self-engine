// The timer's Indicator Panel in the whole app (#350), over Fixed Answers (D255) and a fixed Clock
// (Friday 20 November 2026, 11:00 in Berlin): the form for project, note and start, "Stop at …"
// with a valid and a refused end, "Discard" with "Undo", the lock while an Operation runs, the
// question before unsaved changes are lost, and the Notice of a clock before the start that leads
// to "Stop at …"; as a popover at the wide Layout Step and a sheet from below on the phone. The
// stories speak German, whose clock counts 24 hours, so a time is typed as four digits. Each story
// asserts the calls that reach the Port; that the Data Process answers them as the Contract says
// is shown by the module's tests over the test Data Process.

import type { PortAccess } from "@self-engine/data-client/react";
import { answersByMount } from "@self-engine/data-client/testing";
import { projectReference, projectsAnswers, WEBSITE } from "@self-engine/projects/testing";
import { SHELL_REFERENCE_WIDTHS } from "@self-engine/shell/geometry";
import { resolveTimeZone } from "@self-engine/time";
import { fixedClock, requireInstant } from "@self-engine/time/testing";
import {
  runningTimer,
  type StoredTimeEntries,
  type TimeTrackingAnswers,
  type TimeTrackingCall,
  type TimeTrackingStoryPort,
  timeTrackingStoryPort,
} from "@self-engine/time-tracking/testing";
import { clearNotices } from "@self-engine/ui/story-notices";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { AppAt, keepNoticesOpen, loadStoryApp } from "./story-app.tsx";

const viewport = (name: string, width: number) => ({
  name,
  styles: { width: `${width}px`, height: "800px" },
});
const VIEWPORTS = {
  wide: viewport("Wide", SHELL_REFERENCE_WIDTHS.wide),
  phone: viewport("Phone", 390),
};
type Step = keyof typeof VIEWPORTS;

const IN_BERLIN = {
  clock: fixedClock(requireInstant("2026-11-20T10:00:00.000Z")),
  deviceZone: resolveTimeZone("Europe/Berlin").timeZone,
  region: "de-DE",
} as const;

/** Started at 09:47:13 in Berlin on the project Website, with a note. */
const RUNNING = runningTimer(1, {
  startedAt: "2026-11-20T08:47:13.000Z",
  project: projectReference(WEBSITE),
  note: "Landing page",
});
const { project: _project, ...RUNNING_TIMER } = RUNNING;

let port = timeTrackingStoryPort();

interface PanelStoryArgs {
  readonly stored: StoredTimeEntries;
  readonly answers?: TimeTrackingAnswers;
  /** Changes the stored timers after an Operation, as the Data Process would. */
  readonly afterCall?: (call: TimeTrackingCall, of: TimeTrackingStoryPort) => void;
}

/** The timers' Port beside the projects of the picker; the Table Changes come from the timers'. */
function storyPort({ stored, answers, afterCall }: PanelStoryArgs): PortAccess {
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
  title: "App/Time Tracking/Timer panel",
  parameters: { layout: "fullscreen", viewport: { options: VIEWPORTS } },
  globals: { language: "de", viewport: { value: "wide", isRotated: false } },
  loaders: [loadStoryApp],
  args: { stored: { timers: [RUNNING] } },
  render: (args) => (
    <AppAt access={storyPort(args)} address="/projects/active" answersTimers time={IN_BERLIN} />
  ),
} satisfies Meta<PanelStoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

/** The indicator's and the panel's code arrive in an idle moment, which a busy browser puts off. */
const ARRIVES = { timeout: 4000 };

const at = (step: Step) => ({ globals: { viewport: { value: step, isRotated: false } } });

/** A story of a Notice starts from an empty screen and keeps its Notices open. */
const cleanNotices = () => {
  clearNotices();
  return keepNoticesOpen();
};

/** What the running indicator shows, which opens the panel. */
async function opener(canvas: Canvas) {
  await canvas.findByRole("heading", { level: 1 });
  return canvas.findByRole("button", { name: /^Timer bearbeiten/ }, ARRIVES);
}

/** The open panel, named after the module, and its parts, once it holds the focus. */
async function panelParts() {
  const dialog = await screen.findByRole("dialog", { name: "Zeit" }, ARRIVES);
  const panel = within(dialog);
  // The panel fades in and then takes the focus; keys typed before that would be lost.
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return {
    dialog,
    panel,
    note: () => panel.getByRole("textbox", { name: "Notiz" }),
    project: () => panel.getByLabelText("Projekt") as HTMLInputElement,
    date: () => panel.getByRole("textbox", { name: "Datum" }),
    time: (label: "Beginn" | "Ende") => panel.getByRole("spinbutton", { name: label }),
    button: (name: string) => panel.getByRole("button", { name }),
  };
}

async function openPanel(canvas: Canvas) {
  await userEvent.click(await opener(canvas));
  return panelParts();
}

const panelGone = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: "Zeit" })).toBeNull());

/**
 * Types a time of four digits into the hours of a picker, over what it held. The list stays open
 * until the focus moves on: Esc is the panel's here and would ask whether to discard (#377).
 */
async function typeTime(hours: HTMLElement, digits: string) {
  await userEvent.click(hours);
  await userEvent.keyboard(digits);
}

/** Waits until the Notice with `text` has slid in. */
async function noticeShown(text: string) {
  const notice = await screen.findByText(text);
  await waitFor(() => expect(notice).toBeVisible());
  return notice.closest<HTMLElement>(".mantine-Notification-root")!;
}

/** Where the panel stands: below the indicator at the wide step, a sheet from below on the phone. */
async function expectFrameAt(step: Step, dialog: HTMLElement, openedBy: HTMLElement) {
  if (step === "phone") {
    await waitFor(() =>
      expect(Math.round(dialog.getBoundingClientRect().bottom)).toBe(window.innerHeight),
    );
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(window.innerWidth);
    return;
  }
  await waitFor(() =>
    expect(dialog.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      openedBy.getBoundingClientRect().bottom,
    ),
  );
}

/** The stored timer after an edit, as the Data Process answers it. */
const editAnswered = (call: TimeTrackingCall, of: TimeTrackingStoryPort) => {
  if (call.entry === "editTimer") of.change({ timers: [{ ...RUNNING, note: "Hero section" }] });
};

const theFormAt = (step: Step): Story => ({
  ...at(step),
  args: { afterCall: editAnswered },
  play: async ({ canvas }) => {
    const openedBy = await opener(canvas);
    await expect(openedBy).toHaveAttribute("aria-haspopup", "dialog");
    await expect(openedBy).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(openedBy);
    const form = await panelParts();
    await expectFrameAt(step, form.dialog, openedBy);
    await expect(openedBy).toHaveAttribute("aria-expanded", "true");
    // The note holds the focus, so the project's list stays closed.
    await waitFor(() => expect(form.note()).toHaveFocus());
    await expect(screen.queryByRole("listbox")).toBeNull();
    await expect(form.project()).toHaveValue("Website");
    await expect(form.note()).toHaveValue("Landing page");
    await expect(form.date()).toHaveValue("20.11.2026");
    const [hours, minutes] = form.panel.getAllByRole("spinbutton");
    await expect(hours).toHaveValue("09");
    await expect(minutes).toHaveValue("47");

    await userEvent.clear(form.note());
    await userEvent.type(form.note(), "Hero section");
    await userEvent.click(form.button("Speichern"));
    // A successful save closes the panel without a question.
    await panelGone();
    await expect(screen.queryByRole("dialog", { name: "Änderungen verwerfen?" })).toBeNull();
    await expect(port.calls).toEqual([
      { entry: "editTimer", input: { id: RUNNING.id, note: "Hero section" } },
    ]);
  },
});

export const TheFormAtTheWideStep = theFormAt("wide");
export const TheFormOnThePhone = theFormAt("phone");

/** The stored timers after a stop, and after an undo brought the timer back. */
const stopAndUndo = (call: TimeTrackingCall, of: TimeTrackingStoryPort) => {
  if (call.entry === "stopTimer" || call.entry === "discardTimer") of.change({ timers: [] });
  if (call.entry === "undoStopTimer" || call.entry === "undoDiscardTimer")
    of.change({ timers: [RUNNING] });
};

const stopAtAValidEnd = (step: Step): Story => ({
  ...at(step),
  beforeEach: cleanNotices,
  args: { afterCall: stopAndUndo },
  play: async ({ canvas }) => {
    const form = await openPanel(canvas);
    await userEvent.click(form.button("Stoppen um …"));
    const stopAt = await panelParts();
    // The panel may still be fading in.
    await waitFor(() =>
      expect(stopAt.panel.getByText("Läuft seit 20.11.2026, 09:47")).toBeVisible(),
    );
    await typeTime(stopAt.time("Ende"), "1050");
    await userEvent.click(stopAt.button("Stoppen"));

    await panelGone();
    const notice = await noticeShown("Zeiteintrag gespeichert");
    await expect(
      await canvas.findByRole("button", { name: "Timer starten" }, ARRIVES),
    ).toBeVisible();
    await userEvent.click(within(notice).getByRole("button", { name: "Rückgängig" }));
    await expect(await opener(canvas)).toBeVisible();
    await expect(port.calls).toEqual([
      { entry: "stopTimer", input: { id: RUNNING.id, endedAt: "2026-11-20T09:50:00.000Z" } },
      { entry: "undoStopTimer", input: { id: RUNNING.id } },
    ]);
  },
});

export const StopAtAValidEndAtTheWideStep = stopAtAValidEnd("wide");
export const StopAtAValidEndOnThePhone = stopAtAValidEnd("phone");

const aRefusedEnd = (reason: "end_in_future" | "end_before_start", text: string): Story => ({
  args: { answers: { stopTimer: { invalid: [{ path: ["endedAt"], reason }] } } },
  play: async ({ canvas }) => {
    const form = await openPanel(canvas);
    await userEvent.click(form.button("Stoppen um …"));
    const stopAt = await panelParts();
    await typeTime(stopAt.time("Ende"), "1130");
    await userEvent.click(stopAt.button("Stoppen"));
    // At the end; the panel stays open with what was typed.
    await expect(await stopAt.panel.findByText(text)).toBeVisible();
    await expect(stopAt.time("Ende")).toHaveAccessibleDescription(expect.stringContaining(text));
    await expect(stopAt.dialog).toBeVisible();
    await expect(port.calls).toEqual([
      { entry: "stopTimer", input: { id: RUNNING.id, endedAt: "2026-11-20T10:30:00.000Z" } },
    ]);
  },
});

export const AnEndInTheFutureShowsItsMessageAtTheEnd = aRefusedEnd(
  "end_in_future",
  "Das Ende darf nicht in der Zukunft liegen.",
);
export const AnEndBeforeTheStartShowsItsMessageAtTheEnd = aRefusedEnd(
  "end_before_start",
  "Das Ende muss nach dem Beginn liegen.",
);

export const AStartInTheFutureShowsItsMessageAtTheStart: Story = {
  args: {
    answers: { editTimer: { invalid: [{ path: ["startedAt"], reason: "start_in_future" }] } },
  },
  play: async ({ canvas }) => {
    const form = await openPanel(canvas);
    await typeTime(form.time("Beginn"), "1130");
    await userEvent.click(form.button("Speichern"));
    const message = "Der Beginn darf nicht in der Zukunft liegen.";
    await expect(await form.panel.findByText(message)).toBeVisible();
    await expect(form.time("Beginn")).toHaveAccessibleDescription(expect.stringContaining(message));
    await expect(port.calls).toEqual([
      { entry: "editTimer", input: { id: RUNNING.id, startedAt: "2026-11-20T10:30:00.000Z" } },
    ]);
  },
};

export const DiscardShowsANoticeWhoseUndoLetsTheTimerRunAgain: Story = {
  beforeEach: cleanNotices,
  args: { afterCall: stopAndUndo },
  play: async ({ canvas }) => {
    const form = await openPanel(canvas);
    await userEvent.click(form.button("Verwerfen"));
    await panelGone();
    const notice = await noticeShown("Timer verworfen");
    await expect(
      await canvas.findByRole("button", { name: "Timer starten" }, ARRIVES),
    ).toBeVisible();
    await userEvent.click(within(notice).getByRole("button", { name: "Rückgängig" }));
    await expect(await opener(canvas)).toBeVisible();
    await expect(port.calls).toEqual([
      { entry: "discardTimer", input: { id: RUNNING.id } },
      { entry: "undoDiscardTimer", input: { id: RUNNING.id } },
    ]);
  },
};

export const TheFormIsLockedWhileItsSaveRuns: Story = {
  args: { answers: { editTimer: "loading" } },
  play: async ({ canvas }) => {
    const form = await openPanel(canvas);
    await userEvent.type(form.note(), " v2");
    await userEvent.click(form.button("Speichern"));
    await waitFor(() => expect(form.note()).toBeDisabled());
    await expect(form.project()).toBeDisabled();
    await expect(form.time("Beginn")).toBeDisabled();
    await expect(form.dialog).toBeVisible();
    await expect(port.calls).toEqual([
      { entry: "editTimer", input: { id: RUNNING.id, note: "Landing page v2" } },
    ]);
  },
};

export const ClosingWithUnsavedChangesAsksFirst: Story = {
  play: async ({ canvas }) => {
    const form = await openPanel(canvas);
    await userEvent.type(form.note(), " v2");
    await userEvent.click(form.button("Abbrechen"));
    const question = await screen.findByRole("dialog", { name: "Änderungen verwerfen?" });
    await userEvent.click(within(question).getByRole("button", { name: "Weiter bearbeiten" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Änderungen verwerfen?" })).toBeNull(),
    );
    await expect(form.note()).toHaveValue("Landing page v2");

    await userEvent.click(form.button("Abbrechen"));
    const again = await screen.findByRole("dialog", { name: "Änderungen verwerfen?" });
    await userEvent.click(within(again).getByRole("button", { name: "Verwerfen" }));
    await panelGone();
    await expect(port.calls).toEqual([]);
  },
};

const theNoticeLeadsToStopAt = (step: Step): Story => ({
  ...at(step),
  beforeEach: cleanNotices,
  args: { answers: { stopTimer: { data: { kind: "clockBeforeStart", timer: RUNNING_TIMER } } } },
  play: async ({ canvas }) => {
    await opener(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Timer stoppen" }));
    const notice = await noticeShown(
      "Die Uhr zeigt eine Zeit vor dem Beginn des Timers. Der Timer läuft weiter.",
    );
    await userEvent.click(within(notice).getByRole("button", { name: "Stoppen um …" }));
    const stopAt = await panelParts();
    // The panel may still be fading in.
    await waitFor(() => expect(stopAt.time("Ende")).toBeVisible());
    await expect(stopAt.button("Stoppen")).toBeVisible();
    await expect(port.calls).toEqual([{ entry: "stopTimer", input: { id: RUNNING.id } }]);
  },
});

export const TheNoticeOfAClockBeforeTheStartOpensStopAtAtTheWideStep =
  theNoticeLeadsToStopAt("wide");
export const TheNoticeOfAClockBeforeTheStartOpensStopAtOnThePhone = theNoticeLeadsToStopAt("phone");
