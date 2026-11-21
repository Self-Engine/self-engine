// For stories and tests only (D255): Fixed Answers for `time-tracking` and sample entries. The
// boundary rule keeps this entry, and the Contract schemas it loads, out of the app.

import type { PortAccess } from "@self-engine/data-client/react";
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
  timeTrackingContract,
} from "../contracts/index.ts";
import { groupDays } from "../data/group-days.ts";

const contracts = { timeTracking: timeTrackingContract };

/** What each entry of `time-tracking` answers in a story. */
export type TimeTrackingAnswers = NonNullable<FixedAnswers<typeof contracts>["timeTracking"]>;

/** A well-formed time entry id, numbered: what the Data Process would hand out. */
export function sampleTimeEntryId(index: number): TimeEntryId {
  return timeEntryIdSchema.parse(`01a1cfa1-0e00-7000-8000-${index.toString(16).padStart(12, "0")}`);
}

/**
 * A stored time entry with its Project Reference, as the Data Process answers it: on whole
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
 * checked against the Contract on both ends; `answers` replace that or the succeeding Operations.
 */
export function timeTrackingAnswers(
  stored: StoredTimeEntries = {},
  answers: TimeTrackingAnswers = {},
  options?: FixedAnswerOptions,
): PortAccess {
  const fixed = fixedAnswers(contracts, { timeTracking: { ...SUCCEEDING, ...answers } }, options);
  if (answers.days !== undefined) return fixed;
  const timeZone = stored.timeZone ?? BERLIN;
  const entries = (stored.entries ?? []).toSorted(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
  );
  return {
    ...fixed,
    async call(module, entry, input, signal) {
      if (module !== "timeTracking" || entry !== "days") {
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

/** The tables the Query of a Day Span reads, as the Data Process's Query-to-tables list names them. */
const QUERIES = { timeTracking: { days: ["time_entries", "projects"] } };

/**
 * The Port of a story that changes the stored entries under an open View, as another window, an
 * assistant or the sync would (Changing Answers).
 */
export interface TimeTrackingStoryPort {
  readonly access: PortAccess;
  /** Answers from `next` from now on and delivers the Table Change of `time_entries`. */
  readonly change: (next: StoredTimeEntries) => void;
}

export function timeTrackingStoryPort(first: StoredTimeEntries = {}): TimeTrackingStoryPort {
  const changing = changingAnswers(timeTrackingAnswers(first), QUERIES);
  return {
    access: changing.access,
    change: (next) => changing.change(timeTrackingAnswers(next), ["time_entries"]),
  };
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
