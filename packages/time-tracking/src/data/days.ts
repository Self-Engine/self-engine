// The Query of a Day Span (D343, D147, D193, D352, D354). SQL fetches the window: every Live Row
// that touches the span, joined with the Read Piece of `projects`. TypeScript groups: the Day
// Shares, the days and the sums. Day logic never runs in SQL.
import type { TablesOf } from "@self-engine/db";
import { projectReferences } from "@self-engine/projects/data";
import {
  type ReadTransaction,
  SETTINGS_TABLE,
  sharedEntry,
  type StorageContext,
} from "@self-engine/storage";
import { dayRangesOf, type DaySpan, type DayRange } from "@self-engine/time";
import type { DaysAnswer, TimeEntryFilter } from "../contracts/index.ts";
import { groupDays } from "./group-days.ts";
import {
  JOINED_PROJECT_COLUMNS,
  TIME_ENTRY_COLUMNS,
  projectReferenceOf,
  type timeTrackingRowMap,
  toTimeEntry,
} from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;
type Reads = ReadTransaction<Tables>;

/** The tables the Query reads: the Time Zone is a Setting, so a change of it reloads the Query. */
export const DAYS_READS = ["time_entries", "projects", SETTINGS_TABLE] as const;

/**
 * Every Live Row that touches the window, not only those that begin in it, with its Project
 * Reference, sorted by start. The end index skips rows that end before the window.
 */
export function windowRows(
  tx: Reads,
  context: StorageContext,
  window: { readonly start: DayRange["start"]; readonly end: DayRange["end"] },
  filter: TimeEntryFilter | undefined,
) {
  let query = sharedEntry<Tables>(tx, context)
    .live("time_entries")
    .leftJoin(projectReferences(tx, context, "project"), "project.id", "time_entries.project_id")
    .select(TIME_ENTRY_COLUMNS)
    .select(JOINED_PROJECT_COLUMNS)
    .where("time_entries.started_at", "<", window.end)
    .where("time_entries.ended_at", ">", window.start);
  if (filter?.kind === "project")
    query = query.where("time_entries.project_id", "=", filter.projectId);
  if (filter?.kind === "noProject") query = query.where("time_entries.project_id", "is", null);
  return query.orderBy("time_entries.started_at").orderBy("time_entries.id");
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
  const rows = await windowRows(
    tx,
    context,
    { start: first.start, end: last.end },
    input.filter,
  ).execute();

  return groupDays(
    days,
    rows.map((row) => ({ ...toTimeEntry(row), project: projectReferenceOf(row) })),
  );
}
