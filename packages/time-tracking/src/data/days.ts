// The Query of a Day Span (D343, D147, D193, D352, D354). SQL fetches the window: every Live Row
// that may touch the span, then the Project Shares of those entries with the Read Piece of
// `projects`, in one more read, and the rule and breaks of the entries across midnight alone, in
// one more where there are any. TypeScript places and groups:
// the Rounded Times, the Day Shares, the days and the sums. Day logic never runs in SQL.
import type { TablesOf } from "@self-engine/db";
import { type ReadTransaction, sharedEntry, type StorageContext } from "@self-engine/storage";
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
  breaksTextSchema,
  type DaysAnswer,
  ORDINARY_ROUNDING_MINUTES,
  roundingRuleTextSchema,
  type TimeEntryFilter,
  type TimeEntryId,
} from "../contracts/index.ts";
import { entryTimeZone } from "./entry-time-zone.ts";
import { listedEntries, listedWithProjects } from "./entries-with-project.ts";
import { entriesAcrossMidnight, type EntryStretches, groupDays } from "./group-days.ts";
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

/**
 * The rule, the breaks and the Time Zone of the entries `ids`, read and parsed for them alone:
 * the entries across midnight, which the division of their Day Shares computes with. A rule or
 * list this version cannot read is `null`, as reading is lenient. No read without an id.
 */
async function stretchesOf(
  tx: Reads,
  context: StorageContext,
  ids: readonly TimeEntryId[],
): Promise<ReadonlyMap<TimeEntryId, EntryStretches>> {
  if (ids.length === 0) return new Map();
  const rows = await sharedEntry<Tables>(tx, context)
    .live("time_entries")
    .select([
      "time_entries.id",
      "time_entries.rounding_rule",
      "time_entries.breaks",
      "time_entries.time_zone",
    ])
    .where("time_entries.id", "in", ids)
    .execute();
  return new Map(
    rows.map((row) => {
      const rule = roundingRuleTextSchema.safeDecode(row.rounding_rule);
      const breaks = breaksTextSchema.safeDecode(row.breaks);
      return [
        row.id,
        {
          rule: rule.success ? rule.data : null,
          breaks: breaks.success ? breaks.data : null,
          timeZone: entryTimeZone(row.time_zone).timeZone,
        },
      ];
    }),
  );
}

/** The answer of the Query for a span in the Time Zone of the call. */
export async function spanDays(
  tx: Reads,
  context: StorageContext,
  input: { readonly span: DaySpan; readonly filter?: TimeEntryFilter | undefined },
): Promise<DaysAnswer> {
  const timeZone = await context.readTimeZone(tx);
  const days = dayRangesOf(input.span, timeZone);
  const first = days[0];
  const last = days.at(-1);
  // The input schema keeps the last day at or after the first.
  if (first === undefined || last === undefined) throw new Error("A Day Span has a day");
  // A walk of the end index, a little wider than the span; `groupDays` cuts it exactly on the
  // Rounded Times.
  const rows = await windowRows(tx, context, widened(first.start, last.end)).execute();
  const entries = await listedWithProjects(tx, context, rows);
  const across = entriesAcrossMidnight(days, entries).map(({ id }) => id);
  const stretches = await stretchesOf(tx, context, across);
  return groupDays({ days, timeZone }, entries, stretches, input.filter);
}
