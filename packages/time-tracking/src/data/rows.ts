import { defineMigrations, type TablesOf } from "@self-engine/db";
import { projectIdSchema } from "@self-engine/projects/ids";
import { spaceIdSchema } from "@self-engine/storage";
import {
  durationBetween,
  durationSchema,
  type Instant,
  instantSchema,
  wholeSecondOf,
} from "@self-engine/time";
import { z } from "zod";
import { type TimeEntry, timeEntryIdSchema } from "../contracts/index.ts";

export const timeTrackingMigrations = defineMigrations(
  "time-tracking",
  import.meta.glob<string>("./migrations/*.sql", { query: "?raw", import: "default", eager: true }),
);

// Only its own table: `projects` is read through its released Read Piece (D241).
export const timeTrackingRowMap = {
  time_entries: z.object({
    id: timeEntryIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    started_at: instantSchema,
    ended_at: instantSchema,
    duration_seconds: durationSchema,
    project_id: projectIdSchema.nullable(),
    note: z.string().nullable(),
    // The stored name, as chosen; a later runtime may not know it, so it is no `TimeZone`.
    time_zone: z.string(),
  }),
};
type TimeEntryRow = TablesOf<typeof timeTrackingRowMap>["time_entries"];

/** Only the columns returned in a Query answer. The creation Time Zone stays in storage. */
export const TIME_ENTRY_COLUMNS = [
  "time_entries.id",
  "time_entries.started_at",
  "time_entries.ended_at",
  "time_entries.duration_seconds",
  "time_entries.project_id",
  "time_entries.note",
] as const;

type TimeEntryValues = Pick<
  TimeEntryRow,
  (typeof TIME_ENTRY_COLUMNS)[number] extends `time_entries.${infer Column}` ? Column : never
>;

/**
 * The columns of start, end and Booked Duration, the one place that computes them (D344, D346):
 * both Instants cut to the whole second, and the duration end minus start. Every write of start
 * or end takes all three from here.
 */
export function storedTimes(startedAt: Instant, endedAt: Instant) {
  const started_at = wholeSecondOf(startedAt);
  const ended_at = wholeSecondOf(endedAt);
  return { started_at, ended_at, duration_seconds: durationBetween(started_at, ended_at) };
}

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toTimeEntry = (row: TimeEntryValues): TimeEntry => ({
  id: row.id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationSeconds: row.duration_seconds,
  projectId: row.project_id,
  note: row.note,
});
