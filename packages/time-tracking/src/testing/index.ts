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
  durationBetween,
  instantSchema,
  resolveTimeZone,
  type TimeZone,
} from "@self-engine/time";
import {
  daysAnswerSchema,
  daysInputSchema,
  type TimeEntryId,
  timeEntryIdSchema,
  type TimeEntryWithProject,
  timeEntryWithProjectSchema,
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

/** A well-formed Time Entry id, numbered: what the Data Process would hand out. */
export function sampleTimeEntryId(index: number): TimeEntryId {
  return timeEntryIdSchema.parse(`01a1cfa1-0e00-7000-8000-${index.toString(16).padStart(12, "0")}`);
}

/**
 * A stored Time Entry with its Project Reference, as the Data Process answers it: on whole
 * seconds, with its Booked Duration end minus start. Without a project unless `project` names one
 * (`projectReference` of `@self-engine/projects/testing`).
 */
export function timeEntry(
  index: number,
  fields: {
    readonly startedAt: string;
    readonly endedAt: string;
    readonly project?: ProjectReference | null;
    readonly note?: string | null;
  },
): TimeEntryWithProject {
  const startedAt = instantSchema.parse(fields.startedAt);
  const endedAt = instantSchema.parse(fields.endedAt);
  const project = fields.project ?? null;
  return {
    id: sampleTimeEntryId(index),
    startedAt,
    endedAt,
    durationSeconds: durationBetween(startedAt, endedAt),
    projectId: project?.id ?? null,
    note: fields.note ?? null,
    project,
  };
}

/** The Live Rows a story's Port holds, and the Time Zone of the Setting its Data Process reads. */
export interface StoredTimeEntries {
  readonly entries?: readonly TimeEntryWithProject[];
  /** Berlin unless a story says else, as the app's stories' device zone. */
  readonly timeZone?: TimeZone;
}

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;

/** A sample entry, as every Operation's Fixed Answer returns it. */
const SAMPLE = timeEntry(100, {
  startedAt: "2026-11-16T08:00:00.000Z",
  endedAt: "2026-11-16T09:30:00.000Z",
});
const { project: _sampleProject, ...SAMPLE_ENTRY } = SAMPLE;

/**
 * The answers of a story where every Operation succeeds with a sample entry. An Operation changes
 * nothing: no Table Change follows.
 */
export const SUCCEEDING = {
  create: { data: SAMPLE_ENTRY },
  edit: { data: SAMPLE_ENTRY },
  delete: { data: SAMPLE_ENTRY },
  restore: { data: SAMPLE_ENTRY },
  entry: { data: SAMPLE },
} satisfies TimeTrackingAnswers;

/**
 * The Port access of a story. The Query of a Day Span answers from `stored` for the span and the
 * filter the View asks, grouped in the stored Time Zone as the Data Process groups them, and
 * checked against the Contract on both ends; the Query of one entry answers the stored entry of
 * that id, or `null`. `answers` replace either or the succeeding Operations.
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
  return {
    ...fixed,
    async call(module, entry, input, signal) {
      if (module === "timeTracking" && entry === "entry" && answers.entry === undefined) {
        const { id } = byIdSchema.parse(input);
        const found = entries.find((stored) => stored.id === id) ?? null;
        return timeEntryWithProjectSchema.nullable().parse(found);
      }
      if (module !== "timeTracking" || entry !== "days" || answers.days !== undefined) {
        return fixed.call(module, entry, input, signal);
      }
      const { span, filter } = daysInputSchema.parse(input);
      const kept = entries.filter((stored) =>
        filter === undefined
          ? true
          : filter.kind === "noProject"
            ? stored.projectId === null
            : stored.projectId === filter.projectId,
      );
      return daysAnswerSchema.parse(groupDays(dayRangesOf(span, timeZone), kept));
    },
  };
}

/** The tables each Query reads, as the Data Process's Query-to-tables list names them. */
const QUERIES = {
  timeTracking: { entry: [...TIME_TRACKING_READS.entry], days: [...TIME_TRACKING_READS.days] },
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
  /** Answers from `next` from now on and delivers the Table Change of `time_entries`. */
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
    change: (next) => changing.change(timeTrackingAnswers(next, answers), ["time_entries"]),
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
  /** Wednesday 09:30 to 10:14:10, as a timer leaves it: 44:10 shows "0:45" (D345). */
  review: timeEntry(4, {
    startedAt: "2026-11-18T08:30:00.000Z",
    endedAt: "2026-11-18T09:14:10.000Z",
    project: projectReference(WEBSITE),
    note: "Review",
  }),
  /** Wednesday 10:30 to 10:50:10: 20:10 shows "0:21", and the day 64:20 shows "1:05". */
  fixes: timeEntry(5, {
    startedAt: "2026-11-18T09:30:00.000Z",
    endedAt: "2026-11-18T09:50:10.000Z",
    project: projectReference(WEBSITE),
    note: "Fixes",
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
