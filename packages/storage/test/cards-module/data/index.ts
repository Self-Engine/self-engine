import {
  defineStorageModule,
  sharedEntry,
  sharedWrites,
  smallSetList,
} from "../../../src/core/index.ts";
import { cardIdSchema, cardsContract } from "../contracts/index.ts";
import { cardsMigrations, cardsRowMap, toCard } from "./rows.ts";

/** The edit pattern on a test module: `edit` writes only the fields that travel (D329). */
export const cards = defineStorageModule({
  name: "cards",
  contract: cardsContract,
  migrations: cardsMigrations,
  rowMap: cardsRowMap,
}).entries({
  list: smallSetList(["cards"], async (tx, context) =>
    (await sharedEntry(tx, context).live("cards").selectAll().orderBy("id").execute()).map(toCard),
  ),
  create: {
    kind: "operation",
    async run(tx, context, input) {
      return toCard(
        await sharedWrites(tx, context).insert("cards", context.newId(cardIdSchema), {
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
      return toCard(
        await sharedWrites(tx, context).update("cards", input.id, {
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
      return toCard(await sharedWrites(tx, context).softDelete("cards", input.id));
    },
  },
});
