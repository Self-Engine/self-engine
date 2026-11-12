import { defineStorageModule } from "../../../src/core/index.ts";
import { notesContract } from "../contracts/index.ts";
import { notesMigrations, notesRowMap, noteIdSchema, toNote } from "./rows.ts";
export const notes = defineStorageModule({
  contract: notesContract,
  migrations: notesMigrations,
  rowMap: notesRowMap,
  entries: {
    create: {
      kind: "operation",
      async run(tx, context, input) {
        const row = {
          id: context.newId(noteIdSchema),
          created_at: context.now,
          updated_at: context.now,
          deleted_at: null,
          space_id: context.spaceId,
          title: input.title,
          is_pinned: input.isPinned ? (1 as const) : (0 as const),
        };
        await tx.insertInto("notes").values(row).execute();
        return toNote(row);
      },
    },
    list: {
      kind: "query",
      async run(tx, context) {
        const rows = await tx
          .selectFrom("notes")
          .selectAll()
          .where("space_id", "=", context.spaceId)
          .where("deleted_at", "is", null)
          .orderBy("id")
          .execute();
        return rows.map(toNote);
      },
    },
  },
});
