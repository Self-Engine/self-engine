import { defineStorageModule, sharedEntry, sharedWrites, smallSetList } from "@self-engine/storage";
import { projectIdSchema, projectsContract } from "../contracts/index.ts";
import { projectsMigrations, projectsRowMap, toProject } from "./rows.ts";

/**
 * The Storage of `projects` (D252). It declares no conflicts: no title is unique (D328). The page
 * sorts by title with the App Language's rules, so the Queries keep the order of creation.
 */
export const projects = defineStorageModule({
  name: "projects",
  contract: projectsContract,
  migrations: projectsMigrations,
  rowMap: projectsRowMap,
}).entries({
  active: {
    ...smallSetList(["projects"], async (tx, context) =>
      (
        await sharedEntry(tx, context)
          .active("projects")
          .selectAll()
          .orderBy("created_at")
          .orderBy("id")
          .execute()
      ).map(toProject),
    ),
    active: true,
  },
  archived: smallSetList(["projects"], async (tx, context) =>
    (
      await sharedEntry(tx, context)
        .live("projects")
        .where("projects.archived_at", "is not", null)
        .selectAll()
        .orderBy("created_at")
        .orderBy("id")
        .execute()
    ).map(toProject),
  ),
  create: {
    kind: "operation",
    async run(tx, context, input) {
      return toProject(
        await sharedWrites(tx, context).insert("projects", context.newId(projectIdSchema), {
          title: input.title,
          description: input.description ?? null,
          icon: input.icon ?? null,
          color: input.color ?? null,
        }),
      );
    },
  },
  edit: {
    kind: "operation",
    edit: true,
    async run(tx, context, input) {
      return toProject(
        await sharedWrites(tx, context).update("projects", input.id, {
          title: input.title,
          description: input.description,
          icon: input.icon,
          color: input.color,
        }),
      );
    },
  },
  archive: {
    kind: "operation",
    async run(tx, context, input) {
      return toProject(await sharedWrites(tx, context).archive("projects", input.id));
    },
  },
  unarchive: {
    kind: "operation",
    async run(tx, context, input) {
      return toProject(await sharedWrites(tx, context).unarchive("projects", input.id));
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toProject(await sharedWrites(tx, context).softDelete("projects", input.id));
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      return toProject(await sharedWrites(tx, context).restore("projects", input.id));
    },
  },
});

// The Read Piece for the Queries of a module above (D241, D330).
export { projectReferences } from "./project-references.ts";
