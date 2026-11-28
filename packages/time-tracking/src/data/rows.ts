import { defineMigrations, type TablesOf } from "@self-engine/db";
import { sqliteBoolean } from "@self-engine/db/schema";
import { projectIdSchema } from "@self-engine/projects/ids";
import { spaceIdSchema } from "@self-engine/storage";
import { durationSchema, instantSchema } from "@self-engine/time";
import { z } from "zod";
import {
  breakFindings,
  breaksTextSchema,
  type ListedTimeEntry,
  type ProjectShare,
  projectShareIdSchema,
  roundingRuleIdSchema,
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
    note: z.string().nullable(),
    // The stored text, read with `breaksTextSchema`: a later version may write a stretch this one
    // cannot read, so it is no list of breaks here.
    breaks: z.string(),
    // The stored name, as chosen; a later runtime may not know it, so it is no `TimeZone`.
    time_zone: z.string(),
  }),
  // The projects of an entry, each a Part Row of its entry (ADR 0042, ADR 0044).
  project_shares: z.object({
    id: projectShareIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    time_entry_id: timeEntryIdSchema,
    project_id: projectIdSchema,
    place: z.number().int(),
    weight: z.number().int(),
    project_share: durationSchema,
  }),
  // A project's rules are Part Rows of their project; the app-wide rule names none (ADR 0044).
  rounding_rules: z.object({
    id: roundingRuleIdSchema,
    created_at: instantSchema,
    updated_at: instantSchema,
    deleted_at: instantSchema.nullable(),
    space_id: spaceIdSchema,
    project_id: projectIdSchema.nullable(),
    holds_from: instantSchema.nullable(),
    // The stored text, read with `roundingRuleTextSchema`, as on the entry.
    rounding_rule: z.string(),
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

type ColumnOf<Qualified> =
  Qualified extends `time_entries.${infer Column extends keyof TimeEntryRow}` ? Column : never;
type ColumnsOf<Columns extends readonly string[]> = Pick<TimeEntryRow, ColumnOf<Columns[number]>>;

/** The columns a list reads: never the rule, which a list does not show. */
export const LISTED_TIME_ENTRY_COLUMNS = [
  "time_entries.id",
  "time_entries.started_at",
  "time_entries.ended_at",
  "time_entries.rounded_started_at",
  "time_entries.rounded_ended_at",
  "time_entries.booked_duration",
  "time_entries.note",
] as const;

export type ListedTimeEntryValues = ColumnsOf<typeof LISTED_TIME_ENTRY_COLUMNS>;

/**
 * The columns an answer of one entry reads: also its rule, its breaks, and its Time Zone for the
 * findings. The Time Zone itself stays in storage.
 */
export const TIME_ENTRY_COLUMNS = [
  ...LISTED_TIME_ENTRY_COLUMNS,
  "time_entries.rounding_rule",
  "time_entries.rule_chosen_by_hand",
  "time_entries.breaks",
  "time_entries.time_zone",
] as const;

export type TimeEntryValues = ColumnsOf<typeof TIME_ENTRY_COLUMNS>;

// Do not parse the row here: agreement is checked in tests, not on every query.
export const toListedTimeEntry = (
  row: ListedTimeEntryValues,
): Omit<ListedTimeEntry, "projects"> => ({
  id: row.id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  // The table keeps both ends or neither.
  roundedTime:
    row.rounded_started_at === null || row.rounded_ended_at === null
      ? null
      : { start: row.rounded_started_at, end: row.rounded_ended_at },
  bookedDuration: row.booked_duration,
  note: row.note,
});

/**
 * The entry with its rule, its breaks and its projects: a stored rule or list this version cannot
 * read is answered as `null`, beside the stored numbers, so the entry stays readable. The findings
 * are computed here, on read, and never stored.
 */
export function toTimeEntry(row: TimeEntryValues, projects: readonly ProjectShare[]): TimeEntry {
  const rule = roundingRuleTextSchema.safeDecode(row.rounding_rule);
  const roundingRule = rule.success ? rule.data : null;
  const stored = breaksTextSchema.safeDecode(row.breaks);
  const breaks = stored.success ? stored.data : null;
  const measured = { start: row.started_at, end: row.ended_at };
  return {
    ...toListedTimeEntry(row),
    roundingRule,
    ruleByHand: row.rule_chosen_by_hand === 1 ? roundingRule : null,
    findings: [
      ...findingsOf(roundingRule, row.time_zone),
      ...breakFindings(measured, breaks ?? []),
    ],
    breaks,
    projects: [...projects],
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
