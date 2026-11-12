import { defineStorageModule, sharedEntry, sharedWrites } from "../../../src/core/index.ts";
import { notesContract } from "../contracts/index.ts";
import { notesMigrations, notesRowMap, noteIdSchema, toNote } from "./rows.ts";
export const notes = defineStorageModule({
  contract: notesContract,
  conflicts: { notes_live_title: "title_taken" },
  migrations: notesMigrations,
  rowMap: notesRowMap,
  entries: {
    get: {
      kind: "query",
      async run(tx, context, input) {
        return toNote(await sharedEntry(tx, context).lookup("notes", input.id));
      },
    },
    update: {
      kind: "operation",
      async run(tx, context, input) {
        return toNote(
          await sharedWrites(tx, context).update("notes", input.id, { title: input.title }),
        );
      },
    },
    delete: {
      kind: "operation",
      run(tx, context, input) {
        return sharedWrites(tx, context).softDelete("notes", input.id);
      },
    },
    restore: {
      kind: "operation",
      run(tx, context, input) {
        return sharedWrites(tx, context).restore("notes", input.id);
      },
    },
    create: {
      kind: "operation",
      async run(tx, context, input) {
        const row = await sharedWrites(tx, context).insert("notes", context.newId(noteIdSchema), {
          title: input.title,
          is_pinned: input.isPinned ? 1 : 0,
        });
        return toNote(row);
      },
    },
    list: {
      kind: "query",
      async run(tx, context) {
        const rows = await sharedEntry(tx, context)
          .live("notes")
          .selectAll()
          .orderBy("id")
          .execute();
        return rows.map(toNote);
      },
    },
  },
});
export { noteTitles } from "./read-piece.ts";
