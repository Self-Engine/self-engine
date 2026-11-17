import {
  defineStorageModule,
  sharedEntry,
  sharedWrites,
  smallSetList,
} from "../../../src/core/index.ts";
import { noteTitles } from "../../notes-module/data/index.ts";
import { linksContract, linkIdSchema } from "../contracts/index.ts";
import { linksMigrations, linksRowMap, toLink } from "./rows.ts";
export const links = defineStorageModule({
  name: "noteLinks",
  contract: linksContract,
  migrations: linksMigrations,
  rowMap: linksRowMap,
}).entries({
  create: {
    kind: "operation",
    // The frame's reference check refuses a note that is deleted, unknown or foreign (D337).
    async run(tx, context, input) {
      return toLink(
        await sharedWrites(tx, context).insert("note_links", context.newId(linkIdSchema), {
          note_id: input.noteId,
          label: input.label,
        }),
      );
    },
  },
  update: {
    kind: "operation",
    async run(tx, context, input) {
      return toLink(
        await sharedWrites(tx, context).update("note_links", input.id, {
          note_id: input.noteId,
          label: input.label,
        }),
      );
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toLink(await sharedWrites(tx, context).softDelete("note_links", input.id));
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      return toLink(await sharedWrites(tx, context).restore("note_links", input.id));
    },
  },
  list: smallSetList(
    // Its own table, and the notes table through the released read piece.
    ["note_links", "notes"],
    async (tx, context, input) => {
      let query = sharedEntry(tx, context)
        .live("note_links")
        .leftJoin(noteTitles(tx, context, "target"), "target.id", "note_links.note_id")
        .selectAll("note_links")
        .select(["target.title as noteTitle", "target.deletedAt as noteDeletedAt"])
        .orderBy("target.title")
        .orderBy("note_links.id");
      if (input.title !== undefined) query = query.where("target.title", "=", input.title);
      return (await query.execute()).map((row) => ({
        ...toLink(row),
        noteTitle: row.noteTitle,
        noteDeletedAt: row.noteDeletedAt,
      }));
    },
  ),
});
