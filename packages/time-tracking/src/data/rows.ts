import { defineMigrations, type TablesOf } from "@self-engine/db";
import { sqliteBoolean } from "@self-engine/db/schema";
import { projectIdSchema } from "@self-engine/projects/ids";
import { spaceIdSchema } from "@self-engine/storage";
import { durationSchema, instantSchema } from "@self-engine/time";
import { z } from "zod";
import {
  type ListedTimeEntry,
  roundingRuleTextSchema,
  type TimeEntry,
  timeEntryIdSchema,
  type Timer,
  timerIdSchema,
} from "../contracts/index.ts";
import { findingsOf } from "./entry-time-zone.ts";

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
    rounded_started_at: instantSchema.nullable(),
    rounded_ended_at: instantSchema.nullable(),
    booked_duration: durationSchema,
    // The stored text, read with `roundingRuleTextSchema`: a later version may write a rule this
    // one cannot read, so it is no `RoundingRule` here.
    rounding_rule: z.string(),
    rule_chosen_by_hand: sqliteBoolean,
    project_id: projectIdSchema.nullable(),
    note: z.string().nullable(),
    // The stored name, as chosen; a later runtime may not know it, so it is no `TimeZone`.
    time_zone: z.string(),
  }),
  timers: z.object({
    id: timerIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    started_at: instantSchema,
    project_id: projectIdSchema.nullable(),
    note: z.string().nullable(),
  }),
};
type TimeEntryRow = TablesOf<typeof timeTrackingRowMap>["time_entries"];
type TimerRow = TablesOf<typeof timeTrackingRowMap>["timers"];

type ColumnOf<Qualified> = Qualified extends `time_entries.${infer Column extends keyof TimeEntryRow}`
  ? Column
  : never;
type ColumnsOf<Columns extends readonly string[]> = Pick<TimeEntryRow, ColumnOf<Columns[number]>>;

/** The columns a list reads: never the rule, which a list does not show. */
export const LISTED_TIME_ENTRY_COLUMNS = [
  "time_entries.id",
  "time_entries.started_at",
  "time_entries.ended_at",
  "time_entries.rounded_started_at",
  "time_entries.rounded_ended_at",
  "time_entries.booked_duration",
  "time_entries.project_id",
  "time_entries.note",
] as const;

export type ListedTimeEntryValues = ColumnsOf<typeof LISTED_TIME_ENTRY_COLUMNS>;

/**
 * The columns an answer of one entry reads: also its rule, and its Time Zone for the findings.
 * The Time Zone itself stays in storage.
 */
export const TIME_ENTRY_COLUMNS = [
  ...LISTED_TIME_ENTRY_COLUMNS,
  "time_entries.rounding_rule",
  "time_entries.rule_chosen_by_hand",
  "time_entries.time_zone",
] as const;

export type TimeEntryValues = ColumnsOf<typeof TIME_ENTRY_COLUMNS>;

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toListedTimeEntry = (
  row: ListedTimeEntryValues,
): Omit<ListedTimeEntry, "project"> => ({
  id: row.id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  // The table keeps both ends or neither.
  roundedTime:
    row.rounded_started_at === null || row.rounded_ended_at === null
      ? null
      : { start: row.rounded_started_at, end: row.rounded_ended_at },
  bookedDuration: row.booked_duration,
  projectId: row.project_id,
  note: row.note,
});

/**
 * The entry with its rule: a stored rule this version cannot read is answered as `null`, beside
 * the stored numbers, so the entry stays readable.
 */
export function toTimeEntry(row: TimeEntryValues): TimeEntry {
  const rule = roundingRuleTextSchema.safeDecode(row.rounding_rule);
  const roundingRule = rule.success ? rule.data : null;
  return {
    ...toListedTimeEntry(row),
    roundingRule,
    ruleByHand: row.rule_chosen_by_hand === 1 ? roundingRule : null,
    findings: findingsOf(roundingRule, row.time_zone),
  };
}

/** Only the columns returned in a Query answer. */
export const TIMER_COLUMNS = [
  "timers.id",
  "timers.started_at",
  "timers.project_id",
  "timers.note",
] as const;

export type TimerValues = Pick<
  TimerRow,
  (typeof TIMER_COLUMNS)[number] extends `timers.${infer Column}` ? Column : never
>;

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toTimer = (row: TimerValues): Timer => ({
  id: row.id,
  startedAt: row.started_at,
  projectId: row.project_id,
  note: row.note,
});
