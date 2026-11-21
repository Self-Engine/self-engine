import { defineMigrations, type TablesOf } from "@self-engine/db";
import { type ProjectReference, projectIdSchema } from "@self-engine/projects/contracts";
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
export type TimeEntryRow = TablesOf<typeof timeTrackingRowMap>["time_entries"];

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
export const toTimeEntry = (row: TimeEntryRow): TimeEntry => ({
  id: row.id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationSeconds: row.duration_seconds,
  projectId: row.project_id,
  note: row.note,
});

/**
 * The columns a Query selects from the Read Piece of `projects`, joined as `project`; they give
 * the fields of `JoinedProject`.
 */
export const JOINED_PROJECT_COLUMNS = [
  "project.id as projectRefId",
  "project.title as projectTitle",
  "project.icon as projectIcon",
  "project.color as projectColor",
  "project.archivedAt as projectArchivedAt",
  "project.deletedAt as projectDeletedAt",
] as const;

/** The columns of the Read Piece of `projects`, as a Query of this module selects them. */
export interface JoinedProject {
  readonly projectRefId: ProjectReference["id"] | null;
  readonly projectTitle: string | null;
  readonly projectIcon: string | null;
  readonly projectColor: string | null;
  readonly projectArchivedAt: ProjectReference["archivedAt"];
  readonly projectDeletedAt: ProjectReference["deletedAt"];
}

/** The joined Read Piece as a Project Reference; `null` when no project of this Space was found. */
export function projectReferenceOf(row: JoinedProject): ProjectReference | null {
  if (row.projectRefId === null || row.projectTitle === null) return null;
  return {
    id: row.projectRefId,
    title: row.projectTitle,
    icon: row.projectIcon,
    color: row.projectColor,
    archivedAt: row.projectArchivedAt,
    deletedAt: row.projectDeletedAt,
  };
}
