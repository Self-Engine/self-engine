import { defineStorageModule, sharedEntry, sharedWrites, smallSetList } from "@self-engine/storage";
import { projectReferences } from "../../../src/data/index.ts";
import { projectEntriesContract, projectEntryIdSchema } from "../contracts/index.ts";
import { projectEntriesMigrations, projectEntriesRowMap, toProjectEntry } from "./rows.ts";

export const projectEntries = defineStorageModule({
  name: "projectEntries",
  contract: projectEntriesContract,
  migrations: projectEntriesMigrations,
  rowMap: projectEntriesRowMap,
}).entries({
  create: {
    kind: "operation",
    // The frame's reference check refuses a deleted or unknown project; an archived one is a
    // valid target (D330, D337).
    async run(tx, context, input) {
      return toProjectEntry(
        await sharedWrites(tx, context).insert(
          "project_entries",
          context.newId(projectEntryIdSchema),
          { project_id: input.projectId, label: input.label },
        ),
      );
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toProjectEntry(
        await sharedWrites(tx, context).softDelete("project_entries", input.id),
      );
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      return toProjectEntry(await sharedWrites(tx, context).restore("project_entries", input.id));
    },
  },
  list: smallSetList(["project_entries", "projects"], async (tx, context) =>
    (
      await sharedEntry(tx, context)
        .live("project_entries")
        .leftJoin(
          projectReferences(tx, context, "project"),
          "project.id",
          "project_entries.project_id",
        )
        .selectAll("project_entries")
        .select([
          "project.id as projectRefId",
          "project.title as projectTitle",
          "project.icon as projectIcon",
          "project.color as projectColor",
          "project.archivedAt as projectArchivedAt",
          "project.deletedAt as projectDeletedAt",
        ])
        .orderBy("project.title")
        .orderBy("project_entries.id")
        .execute()
    ).map((row) => ({
      ...toProjectEntry(row),
      project:
        row.projectRefId === null || row.projectTitle === null
          ? null
          : {
              id: row.projectRefId,
              title: row.projectTitle,
              icon: row.projectIcon,
              color: row.projectColor,
              archivedAt: row.projectArchivedAt,
              deletedAt: row.projectDeletedAt,
            },
    })),
  ),
});
