import {
  defineStorageModule,
  sharedEntry,
  sharedWrites,
  smallSetList,
} from "../../../src/core/index.ts";
import { memoIdSchema, memosContract } from "../contracts/index.ts";
import { memosMigrations, memosRowMap, toMemo } from "./rows.ts";

/** The edit pattern on a test module: `edit` writes only the fields that travel (D329). */
export const memos = defineStorageModule({
  name: "memos",
  contract: memosContract,
  migrations: memosMigrations,
  rowMap: memosRowMap,
}).entries({
  list: smallSetList(["memos"], async (tx, context) =>
    (await sharedEntry(tx, context).live("memos").selectAll().orderBy("id").execute()).map(toMemo),
  ),
  create: {
    kind: "operation",
    async run(tx, context, input) {
      return toMemo(
        await sharedWrites(tx, context).insert("memos", context.newId(memoIdSchema), {
          title: input.title,
          body: input.body ?? null,
          color: input.color ?? null,
        }),
      );
    },
  },
  edit: {
    kind: "operation",
    edit: true,
    async run(tx, context, input) {
      return toMemo(
        await sharedWrites(tx, context).update("memos", input.id, {
          title: input.title,
          body: input.body,
          color: input.color,
        }),
      );
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toMemo(await sharedWrites(tx, context).softDelete("memos", input.id));
    },
  },
});
