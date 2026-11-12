import type { TablesOf } from "@self-engine/db";
import { defineStorageModule, sharedEntry, sharedWrites } from "../../../src/core/index.ts";
import { notes, noteTitles } from "../../notes-module/data/index.ts";
import { linksContract, linkIdSchema } from "../contracts/index.ts";
import { linksMigrations, linksRowMap, toLink } from "./rows.ts";
export const links = defineStorageModule({
  contract: linksContract,
  migrations: [...notes.migrations, ...linksMigrations],
  rowMap: linksRowMap,
  entries: {
    create: {
      kind: "operation",
      async run(tx, context, input) {
        return toLink(
          await sharedWrites(tx, context).insert("note_links", context.newId(linkIdSchema), {
            note_id: input.noteId,
            label: input.label,
          }),
        );
      },
    },
    list: {
      kind: "query",
      async run(tx, context, input) {
        let query = sharedEntry<TablesOf<typeof linksRowMap>>(tx, context)
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
    },
  },
});
