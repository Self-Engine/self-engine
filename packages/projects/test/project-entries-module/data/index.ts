import { ORPCError } from "@orpc/contract";
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
    async run(tx, context, input) {
      // Hiding archived projects is display, not a rule: only a deleted or unknown one is refused.
      const project = await tx
        .selectFrom(projectReferences(tx, context, "project"))
        .select("project.id")
        .where("project.id", "=", input.projectId)
        .where("project.deletedAt", "is", null)
        .executeTakeFirst();
      if (project === undefined) throw new ORPCError("NOT_FOUND");
      return toProjectEntry(
        await sharedWrites(tx, context).insert(
          "project_entries",
          context.newId(projectEntryIdSchema),
          { project_id: input.projectId, label: input.label },
        ),
      );
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
