import { projectReferences } from "@self-engine/projects/data";
import { defineStorageModule, sharedEntry, sharedWrites } from "@self-engine/storage";
import { timeEntryIdSchema, timeTrackingContract } from "../contracts/index.ts";
import { DAYS_READS, spanDays } from "./days.ts";
import {
  JOINED_PROJECT_COLUMNS,
  projectReferenceOf,
  storedTimes,
  timeTrackingMigrations,
  timeTrackingRowMap,
  toTimeEntry,
} from "./rows.ts";

/**
 * The Storage of `time-tracking` (D252). It registers no Protection Rule: "end after start" is a
 * check of the input, and overlapping entries are valid data (D311). It refers to `projects`
 * through a column and reads it through its Read Piece; `projects` knows nothing of it (D308).
 */
export const timeTracking = defineStorageModule({
  name: "timeTracking",
  contract: timeTrackingContract,
  migrations: timeTrackingMigrations,
  rowMap: timeTrackingRowMap,
}).entries({
  create: {
    kind: "operation",
    // The frame's reference check refuses a deleted or unknown project; an archived one is a
    // valid target (D330, D337).
    async run(tx, context, input) {
      return toTimeEntry(
        await sharedWrites(tx, context).insert("time_entries", context.newId(timeEntryIdSchema), {
          ...storedTimes(input.startedAt, input.endedAt),
          project_id: input.projectId ?? null,
          note: input.note ?? null,
          // The zone the call computes with, read in its transaction (D342, D353).
          time_zone: await context.readTimeZone(tx),
        }),
      );
    },
  },
  entry: {
    kind: "query",
    reads: ["time_entries", "projects"],
    async run(tx, context, input) {
      const row = await sharedEntry(tx, context)
        .live("time_entries")
        .leftJoin(
          projectReferences(tx, context, "project"),
          "project.id",
          "time_entries.project_id",
        )
        .selectAll("time_entries")
        .select(JOINED_PROJECT_COLUMNS)
        .where("time_entries.id", "=", input.id)
        .executeTakeFirst();
      return row === undefined ? null : { ...toTimeEntry(row), project: projectReferenceOf(row) };
    },
  },
  days: { kind: "query", reads: DAYS_READS, run: spanDays },
});
