// For stories and tests only (D255): Fixed Answers for `time-tracking` and sample entries. The
// boundary rule keeps this entry, and the Contract schemas it loads, out of the app.

import type { PortAccess } from "@self-engine/data-client/react";
import { targetDeleted } from "@self-engine/db/schema";
import { z } from "zod";
import {
  changingAnswers,
  type FixedAnswerOptions,
  type FixedAnswers,
  fixedAnswers,
} from "@self-engine/data-client/testing";
import type { ProjectReference } from "@self-engine/projects/contracts";
import { GARDEN, OLD_SITE, projectReference, WEBSITE } from "@self-engine/projects/testing";
import {
  dayRangesOf,
  durationSchema,
  instantSchema,
  resolveTimeZone,
  type TimeZone,
} from "@self-engine/time";
import {
  type Break,
  computeTimeEntry,
  DEFAULT_ROUNDING_RULE,
  type RoundingRule,
  daysAnswerSchema,
  daysInputSchema,
  type ListedTimeEntry,
  type TimeEntry,
  type TimeEntryId,
  timeEntryIdSchema,
  type TimeEntryWithProject,
  timeEntryWithProjectSchema,
  type TimeKind,
  type Timer,
  type TimerId,
  timerIdSchema,
  type TimerWithProject,
  timerWithProjectSchema,
  timeTrackingContract,
} from "../contracts/index.ts";
import { groupDays } from "../data/group-days.ts";
import { TIME_TRACKING_READS } from "../data/reads.ts";

const contracts = { timeTracking: timeTrackingContract };
const byIdSchema = z.strictObject({ id: timeEntryIdSchema });

/**
 * What each entry of `time-tracking` answers in a story. A refused write may carry the frame's
 * Reason of a deleted project (D337), the only Reason its writes meet.
 */
export type TimeTrackingAnswers = NonNullable<
  FixedAnswers<typeof contracts, typeof targetDeleted>["timeTracking"]
>;
export type TimeTrackingAnswerOptions = Omit<FixedAnswerOptions<typeof targetDeleted>, "reasons">;

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;

/** A well-formed Time Entry id, numbered: what the Data Process would hand out. */
export function sampleTimeEntryId(index: number): TimeEntryId {
  return timeEntryIdSchema.parse(`01a1cfa1-0e00-7000-8000-${index.toString(16).padStart(12, "0")}`);
}

/**
 * A stored Time Entry with its Project Reference, as the Data Process answers it: its Measured
 * Time on whole seconds, and its Rounded Time and Booked Duration as `computeTimeEntry` makes them
 * with `rule` in Berlin (default: the built-in "round up to 1 minute", not chosen by hand).
 * Without a project unless `project` names one (`projectReference` of
 * `@self-engine/projects/testing`), or `projects` names several with their Weights, the Lead
 * Project first; the Project Shares divide as the Operation divides. A Work Entry unless
 * `timeKind` names another kind; an entry that is not work takes no project, breaks or rule.
 */
export function timeEntry(
  index: number,
  fields: {
    readonly timeKind?: TimeKind;
    /** The mark "changed by the limit" of a Rest Break entry. */
    readonly changedByLimit?: boolean;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly project?: ProjectReference | null;
    readonly projects?: readonly { readonly project: ProjectReference; readonly weight: number }[];
    readonly note?: string | null;
    /** A rule chosen by hand. */
    readonly rule?: RoundingRule;
    /** The breaks inside the entry; none without. */
    readonly breaks?: readonly Break[] | null;
  },
): TimeEntryWithProject {
  const startedAt = instantSchema.parse(fields.startedAt);
  const endedAt = instantSchema.parse(fields.endedAt);
  const timeKind = fields.timeKind ?? "work";
  const projects =
    fields.projects ?? (fields.project == null ? [] : [{ project: fields.project, weight: 1 }]);
  const rule = fields.rule ?? DEFAULT_ROUNDING_RULE;
  const breaks = [...(fields.breaks ?? [])];
  const { roundedTime, bookedDuration, findings, projectShares } = computeTimeEntry({
    timeKind,
    measuredTime: { start: startedAt, end: endedAt },
    timeZone: BERLIN,
    rule,
    breaks,
    projects,
  });
  const entry = {
    id: sampleTimeEntryId(index),
    startedAt,
    endedAt,
    roundedTime,
    bookedDuration,
    findings: [...findings],
    note: fields.note ?? null,
  };
  if (timeKind === "rest_break")
    return { timeKind, ...entry, changedByLimit: fields.changedByLimit ?? false };
  if (timeKind !== "work") return { timeKind, ...entry };
  return {
    timeKind,
    ...entry,
    roundingRule: rule,
    ruleByHand: fields.rule ?? null,
    breaks,
    projects: projects.map(({ project, weight }, index) => ({
      projectId: project.id,
      weight,
      projectShare: projectShares[index] ?? durationSchema.parse(0),
      project,
    })),
  };
}

/** An entry as an Operation answers it: its projects without their Project References. */
export function timeEntryAnswer(entry: TimeEntryWithProject): TimeEntry {
  if (entry.timeKind !== "work") return entry;
  const { projects, ...work } = entry;
  return { ...work, projects: projects.map(({ project: _project, ...share }) => share) };
}

/** An entry as a list holds it: without its rule, its findings, its breaks and a Rest Break's mark. */
export function listedTimeEntry(entry: TimeEntryWithProject): ListedTimeEntry {
  const { id, startedAt, endedAt, roundedTime, bookedDuration, note } = entry;
  const listed = { id, startedAt, endedAt, roundedTime, bookedDuration, note };
  if (entry.timeKind === "work") return { timeKind: "work", ...listed, projects: entry.projects };
  return { timeKind: entry.timeKind, ...listed };
}

/** A well-formed Timer id, numbered: what the Data Process would hand out. */
export function sampleTimerId(index: number): TimerId {
  return timerIdSchema.parse(`01a1cfa1-0b00-7000-8000-${index.toString(16).padStart(12, "0")}`);
}

/**
 * A running Timer with its Project Reference, as the Query of the running timers answers it: its
 * start on a whole second. Without a project unless `project` names one (`projectReference` of
 * `@self-engine/projects/testing`).
 */
export function runningTimer(
  index: number,
  fields: {
    readonly startedAt: string;
    readonly project?: ProjectReference | null;
    readonly note?: string | null;
  },
): TimerWithProject {
  const project = fields.project ?? null;
  return {
    id: sampleTimerId(index),
    startedAt: instantSchema.parse(fields.startedAt),
    projectId: project?.id ?? null,
    note: fields.note ?? null,
    project,
  };
}

/** The Live Rows a story's Port holds, and the Time Zone of the Setting its Data Process reads. */
export interface StoredTimeEntries {
  readonly entries?: readonly TimeEntryWithProject[];
  /** The running timers, in any order: the Query answers the most recently started first. */
  readonly timers?: readonly TimerWithProject[];
  /** Berlin unless a story says else, as the app's stories' device zone. */
  readonly timeZone?: TimeZone;
}

/** A sample entry, as every Operation's Fixed Answer returns it. */
const SAMPLE = timeEntry(100, {
  startedAt: "2026-11-16T08:00:00.000Z",
  endedAt: "2026-11-16T09:30:00.000Z",
});
const SAMPLE_ENTRY = timeEntryAnswer(SAMPLE);

/** A sample timer, as every timer Operation's Fixed Answer returns it. */
const SAMPLE_TIMER: Timer = (({ project: _project, ...timer }) => timer)(
  runningTimer(100, { startedAt: "2026-11-16T08:00:00.000Z" }),
);

/**
 * The answers of a story where every Operation succeeds with a sample entry. An Operation changes
 * nothing: no Table Change follows.
 */
export const SUCCEEDING = {
  create: { data: SAMPLE_ENTRY },
  edit: { data: SAMPLE_ENTRY },
  move: { data: SAMPLE_ENTRY },
  delete: { data: SAMPLE_ENTRY },
  restore: { data: SAMPLE_ENTRY },
  entry: { data: SAMPLE },
  startTimer: { data: { timer: SAMPLE_TIMER, others: [] } },
  editTimer: { data: SAMPLE_TIMER },
  stopTimer: { data: { kind: "saved", entry: SAMPLE_ENTRY } },
  discardTimer: { data: SAMPLE_TIMER },
  undoStopTimer: { data: { kind: "restored", timer: SAMPLE_TIMER, others: [] } },
  undoDiscardTimer: { data: { kind: "restored", timer: SAMPLE_TIMER, others: [] } },
} satisfies TimeTrackingAnswers;

const runningTimersSchema = z.array(timerWithProjectSchema);

/**
 * The Port access of a story. The Query of a Day Span answers from `stored` for the span and the
 * filter the View asks, grouped in the stored Time Zone as the Data Process groups them, and
 * checked against the Contract on both ends; the Query of one entry answers the stored entry of
 * that id, or `null`; the running timers answer the stored timers, the most recently started
 * first. `answers` replace any of them or the succeeding Operations.
 */
export function timeTrackingAnswers(
  stored: StoredTimeEntries = {},
  answers: TimeTrackingAnswers = {},
  options: TimeTrackingAnswerOptions = {},
): PortAccess {
  const fixed = fixedAnswers(
    contracts,
    { timeTracking: { ...SUCCEEDING, ...answers } },
    { ...options, reasons: [targetDeleted] },
  );
  const timeZone = stored.timeZone ?? BERLIN;
  const entries = (stored.entries ?? []).toSorted(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );
  const timers = (stored.timers ?? []).toSorted(
    (a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id),
  );
  return {
    ...fixed,
    async call(module, entry, input, signal) {
      if (
        module === "timeTracking" &&
        entry === "runningTimers" &&
        answers.runningTimers === undefined
      ) {
        return runningTimersSchema.parse(timers);
      }
      if (module === "timeTracking" && entry === "entry" && answers.entry === undefined) {
        const { id } = byIdSchema.parse(input);
        const found = entries.find((stored) => stored.id === id) ?? null;
        return timeEntryWithProjectSchema.nullable().parse(found);
      }
      if (module !== "timeTracking" || entry !== "days" || answers.days !== undefined) {
        return fixed.call(module, entry, input, signal);
      }
      const { span, filter } = daysInputSchema.parse(input);
      // `groupDays` places the entries by their Rounded Times and cuts them exactly, as the Data
      // Process does after its window.
      return daysAnswerSchema.parse(
        groupDays(dayRangesOf(span, timeZone), entries.map(listedTimeEntry), filter),
      );
    },
  };
}

/** The tables each Query reads, as the Data Process's Query-to-tables list names them. */
const QUERIES = {
  timeTracking: {
    entry: [...TIME_TRACKING_READS.entry],
    days: [...TIME_TRACKING_READS.days],
    runningTimers: [...TIME_TRACKING_READS.runningTimers],
  },
};

/** A call of an Operation that reached a story's Port. */
export interface TimeTrackingCall {
  readonly entry: string;
  readonly input: unknown;
}

/**
 * The Port of a story that changes the stored entries under an open View, as another window, an
 * assistant or the sync would (Changing Answers). It records each Operation's call.
 */
export interface TimeTrackingStoryPort {
  readonly access: PortAccess;
  /** The Operations called so far, in order; the Queries are left out. */
  readonly calls: readonly TimeTrackingCall[];
  /**
   * Answers from `next` from now on and delivers the Table Change of `time_entries` and `timers`,
   * as a stop or an undo of the Data Process would.
   */
  readonly change: (next: StoredTimeEntries) => void;
}

/**
 * `answers` replace what the Operations answer; `afterCall` runs after each Operation's answer,
 * such as to change the stored entries as the Data Process would have.
 */
export function timeTrackingStoryPort(
  first: StoredTimeEntries = {},
  answers: TimeTrackingAnswers = {},
  afterCall?: (call: TimeTrackingCall, port: TimeTrackingStoryPort) => void,
): TimeTrackingStoryPort {
  const changing = changingAnswers(timeTrackingAnswers(first, answers), QUERIES);
  const calls: TimeTrackingCall[] = [];
  const port: TimeTrackingStoryPort = {
    calls,
    access: {
      ...changing.access,
      async call(module, entry, input, signal) {
        if (changing.access.describeEntry(module, entry)?.kind === "query")
          return changing.access.call(module, entry, input, signal);
        const call = { entry, input };
        calls.push(call);
        try {
          return await changing.access.call(module, entry, input, signal);
        } finally {
          afterCall?.(call, port);
        }
      },
    },
    change: (next) =>
      changing.change(timeTrackingAnswers(next, answers), ["time_entries", "timers"]),
  };
  return port;
}

/**
 * A sample week, Monday 16 to Sunday 22 November 2026, as Berlin (UTC+1) sees it; the times in
 * the comments are Berlin's. Saturday and Sunday are empty.
 */
export const SAMPLE_WEEK = {
  /** Monday 08:00 to 11:30. */
  landingPage: timeEntry(1, {
    startedAt: "2026-11-16T07:00:00.000Z",
    endedAt: "2026-11-16T10:30:00.000Z",
    project: projectReference(WEBSITE),
    note: "Landing page",
  }),
  /** Monday 13:00 to 14:15, without a project. */
  emails: timeEntry(2, {
    startedAt: "2026-11-16T12:00:00.000Z",
    endedAt: "2026-11-16T13:15:00.000Z",
    note: "Emails",
  }),
  /** Tuesday 09:00 to 12:00, a project with an emoji. */
  beds: timeEntry(3, {
    startedAt: "2026-11-17T08:00:00.000Z",
    endedAt: "2026-11-17T11:00:00.000Z",
    project: projectReference(GARDEN),
    note: "Raised beds",
  }),
  /**
   * Wednesday 09:30 to 10:14:10, as a Timer leaves it, with the rule Exact chosen by hand: 44:10
   * counts and shows "0:44:10".
   */
  review: timeEntry(4, {
    startedAt: "2026-11-18T08:30:00.000Z",
    endedAt: "2026-11-18T09:14:10.000Z",
    project: projectReference(WEBSITE),
    note: "Review",
    rule: { kind: "exact" },
  }),
  /** Wednesday 10:30 to 10:50:10, Exact: 20:10 shows "0:20:10", and the day totals "1:04:20". */
  fixes: timeEntry(5, {
    startedAt: "2026-11-18T09:30:00.000Z",
    endedAt: "2026-11-18T09:50:10.000Z",
    project: projectReference(WEBSITE),
    note: "Fixes",
    rule: { kind: "exact" },
  }),
  /** Thursday 22:00 to Friday 01:30: across midnight. */
  release: timeEntry(6, {
    startedAt: "2026-11-19T21:00:00.000Z",
    endedAt: "2026-11-20T00:30:00.000Z",
    project: projectReference(WEBSITE),
    note: "Release",
  }),
  /** Friday 09:00 to 10:00, of an archived project. */
  handover: timeEntry(7, {
    startedAt: "2026-11-20T08:00:00.000Z",
    endedAt: "2026-11-20T09:00:00.000Z",
    project: projectReference(OLD_SITE),
    note: "Handover",
  }),
} as const;

/** The entries of the sample week, as a story's Port stores them. */
export const SAMPLE_WEEK_ENTRIES: readonly TimeEntryWithProject[] = Object.values(SAMPLE_WEEK);

/** The entry as the Work Entry a test expects it to be; throws for an entry that is not work. */
export function asWorkEntry<Entry extends { readonly timeKind: string }>(
  entry: Entry,
): Extract<Entry, { readonly timeKind: "work" }> {
  if (entry.timeKind !== "work") throw new Error(`Expected a Work Entry, got ${entry.timeKind}`);
  return entry as Extract<Entry, { readonly timeKind: "work" }>;
}
