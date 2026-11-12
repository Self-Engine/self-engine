import { defineStorageModule, sharedEntry, sharedWrites, smallSetList } from "@self-engine/storage";
import { entryIdSchema, placeholderAlphaContract } from "../contracts/index.ts";
import { entriesMigrations, entriesRowMap, toEntry } from "./rows.ts";

/** The Storage of `placeholder-alpha` (D252), the template every later module copies. */
export const placeholderAlpha = defineStorageModule({
  name: "placeholderAlpha",
  contract: placeholderAlphaContract,
  conflicts: { placeholder_alpha_entries_live_name: "name_taken" },
  migrations: entriesMigrations,
  rowMap: entriesRowMap,
}).entries({
  list: smallSetList(["placeholder_alpha_entries"], async (tx, context) =>
    (
      await sharedEntry(tx, context)
        .live("placeholder_alpha_entries")
        .selectAll()
        .orderBy("created_at")
        .orderBy("id")
        .execute()
    ).map(toEntry),
  ),
  create: {
    kind: "operation",
    async run(tx, context, input) {
      return toEntry(
        await sharedWrites(tx, context).insert(
          "placeholder_alpha_entries",
          context.newId(entryIdSchema),
          { name: input.name },
        ),
      );
    },
  },
  rename: {
    kind: "operation",
    async run(tx, context, input) {
      return toEntry(
        await sharedWrites(tx, context).update("placeholder_alpha_entries", input.id, {
          name: input.name,
        }),
      );
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toEntry(
        await sharedWrites(tx, context).softDelete("placeholder_alpha_entries", input.id),
      );
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      return toEntry(
        await sharedWrites(tx, context).restore("placeholder_alpha_entries", input.id),
      );
    },
  },
});
