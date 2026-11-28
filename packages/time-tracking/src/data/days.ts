// The Query of a Day Span (D343, D147, D193, D352, D354). SQL fetches the window: every Live Row
// that may touch the span, then the Project Shares of those entries with the Read Piece of
// `projects`, in one more read. TypeScript places and groups:
// the Rounded Times, the Day Shares, the days and the sums. Day logic never runs in SQL.
import type { TablesOf } from "@self-engine/db";
import type { ReadTransaction, StorageContext } from "@self-engine/storage";
import {
  addDuration,
  dayRangesOf,
  type DayRange,
  type DaySpan,
  durationSchema,
  type Instant,
  subtractDuration,
} from "@self-engine/time";
import {
  BLOCK_ROUNDING_MINUTES,
  type DaysAnswer,
  ORDINARY_ROUNDING_MINUTES,
  type TimeEntryFilter,
} from "../contracts/index.ts";
import { listedEntries, listedWithProjects } from "./entries-with-project.ts";
import { groupDays } from "./group-days.ts";
import type { timeTrackingRowMap } from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;
type Reads = ReadTransaction<Tables>;

/**
 * How far a Rounded Time can lie from its Measured Time: the longest step or Block of any rule.
 * Ordinary Rounding moves the end by less than one step; Block Rounding moves each edge by less
 * than one Block.
 */
const ROUNDING_REACH = durationSchema.parse(
  Math.max(...ORDINARY_ROUNDING_MINUTES, ...BLOCK_ROUNDING_MINUTES) * 60,
);

/**
 * Every Live Row whose Measured Time touches the window, not only those that begin in it. The end
 * index skips rows that end before the window.
 */
export function windowRows(
  tx: Reads,
  context: StorageContext,
  window: { readonly start: DayRange["start"]; readonly end: DayRange["end"] },
) {
  return listedEntries(tx, context)
    .where("time_entries.started_at", "<", window.end)
    .where("time_entries.ended_at", ">", window.start)
    .orderBy("time_entries.started_at")
    .orderBy("time_entries.id");
}

/** The window widened by the reach of rounding, so it holds every Rounded Time that touches it. */
function widened(start: Instant, end: Instant) {
  return {
    start: subtractDuration(start, ROUNDING_REACH),
    end: addDuration(end, ROUNDING_REACH),
  };
}

/** The answer of the Query for a span in the Time Zone of the call. */
export async function spanDays(
  tx: Reads,
  context: StorageContext,
  input: { readonly span: DaySpan; readonly filter?: TimeEntryFilter | undefined },
): Promise<DaysAnswer> {
  const days = dayRangesOf(input.span, await context.readTimeZone(tx));
  const first = days[0];
  const last = days.at(-1);
  // The input schema keeps the last day at or after the first.
  if (first === undefined || last === undefined) throw new Error("A Day Span has a day");
  // A walk of the end index, a little wider than the span; `groupDays` cuts it exactly on the
  // Rounded Times.
  const rows = await windowRows(tx, context, widened(first.start, last.end)).execute();
  return groupDays(days, await listedWithProjects(tx, context, rows), input.filter);
}
