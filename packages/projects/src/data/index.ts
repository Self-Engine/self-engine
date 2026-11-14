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
});
