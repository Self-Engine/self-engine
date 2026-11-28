// The Query of a Day Span (D343, D354): everything the week View shows, computed in the Data
// Process. The page names the span; the Data Process reads only the Time Zone.
import { projectIdSchema, projectReferenceSchema } from "@self-engine/projects/contracts";
import { calendarDaySchema, daySpanSchema, daysBetween, durationSchema } from "@self-engine/time";
import { z } from "zod";
import { listedTimeEntrySchema } from "./entries.ts";

/** The most days one span may hold: six weeks, enough for a month grid later. */
export const SPAN_MAX_DAYS = 42;

/** The Reason of a span longer than `SPAN_MAX_DAYS`, reported at its last day. */
export const SPAN_TOO_LONG = "span_too_long";

/**
 * Which entries the answer holds: those of one project, or those without a project. Without a
 * filter it holds every entry. The filter acts on the entries and on every sum.
 */
export const timeEntryFilterSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("project"), projectId: projectIdSchema }),
  z.strictObject({ kind: z.literal("noProject") }),
]);
export type TimeEntryFilter = z.output<typeof timeEntryFilterSchema>;

export const daysInputSchema = z.strictObject({
  span: daySpanSchema.refine(({ first, last }) => daysBetween(first, last) < SPAN_MAX_DAYS, {
    path: ["last"],
    params: { reason: SPAN_TOO_LONG },
  }),
  filter: timeEntryFilterSchema.optional(),
});
export type DaysInput = z.input<typeof daysInputSchema>;

/**
 * An entry on one day: the entry with its Project Reference, its Day Share there, whether it
 * touches more than one day and whether its Rounded Time overlaps another entry's in the window.
 * An entry that crosses midnight appears on each day of the span it touches, with the same id and
 * marks. An entry without a Rounded Time stands on the day of its measured start with 0:00.
 */
export const dayEntrySchema = listedTimeEntrySchema.extend({
  dayShare: durationSchema,
  crossesMidnight: z.boolean(),
  overlaps: z.boolean(),
});
export type DayEntry = z.output<typeof dayEntrySchema>;

/** One day of the span: the entries that touch it, sorted by start, and the sum of their shares. */
export const spanDaySchema = z.object({
  day: calendarDaySchema,
  entries: z.array(dayEntrySchema),
  total: durationSchema,
});
export type SpanDay = z.output<typeof spanDaySchema>;

/** The sum of one project's Day Shares in the span; `project` is `null` for "no project". */
export const projectTotalSchema = z.object({
  project: projectReferenceSchema.nullable(),
  total: durationSchema,
});
export type ProjectTotal = z.output<typeof projectTotalSchema>;

/**
 * The answer: every day of the span in order, the sums per project, and the span's total. Each
 * sum adds whole seconds and counts only the parts of the entries that lie in the span. The
 * projects come by their sum, largest first, ties by id; "no project" comes last. A project
 * without a share in the span has no line.
 */
export const daysAnswerSchema = z.object({
  days: z.array(spanDaySchema),
  projects: z.array(projectTotalSchema),
  total: durationSchema,
});
export type DaysAnswer = z.output<typeof daysAnswerSchema>;
