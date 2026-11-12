import type { Instant } from "@self-engine/time";
import type { TablesOf } from "@self-engine/db";
import {
  defineStorageModule,
  sharedEntry,
  sharedWrites,
  smallSetList,
  windowList,
  pageList,
  type ReadTransaction,
  type StorageContext,
} from "../../../src/core/index.ts";
import { notesContract } from "../contracts/index.ts";
import { notesMigrations, notesRowMap, noteIdSchema, toNote } from "./rows.ts";
type NotesRead = ReadTransaction<TablesOf<typeof notesRowMap>>;
function allNotes(tx: NotesRead, context: StorageContext) {
  return sharedEntry(tx, context).live("notes").selectAll();
}
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
    list: smallSetList(async (tx: NotesRead, context: StorageContext) => {
      return (await allNotes(tx, context).orderBy("id").execute()).map(toNote);
    }),
    window: windowList(
      async (
        tx: NotesRead,
        context: StorageContext,
        input: {
          from: Instant;
          to: Instant;
        },
      ) => {
        return (
          await allNotes(tx, context)
            .where("created_at", ">=", input.from)
            .where("created_at", "<", input.to)
            .orderBy("id")
            .execute()
        ).map(toNote);
      },
    ),
    pages: pageList({
      query: allNotes,
      order: [
        { column: "created_at", direction: "asc" },
        { column: "id", direction: "asc" },
      ],
      map: toNote,
    }),
  },
});
export { noteTitles } from "./read-piece.ts";
