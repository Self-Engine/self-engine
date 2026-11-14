import {
  defineStorageModule,
  sharedEntry,
  sharedWrites,
  smallSetList,
} from "../../../src/core/index.ts";
import { cardIdSchema, cardsContract } from "../contracts/index.ts";
import { cardsMigrations, cardsRowMap, toCard } from "./rows.ts";

export const cards = defineStorageModule({
  name: "cards",
  contract: cardsContract,
  migrations: cardsMigrations,
  rowMap: cardsRowMap,
}).entries({
  get: {
    kind: "query",
    reads: ["cards"],
    async run(tx, context, input) {
      return toCard(await sharedEntry(tx, context).lookup("cards", input.id));
    },
  },
  create: {
    kind: "operation",
    async run(tx, context, input) {
      return toCard(
        await sharedWrites(tx, context).insert("cards", context.newId(cardIdSchema), {
          title: input.title,
        }),
      );
    },
  },
  archive: {
    kind: "operation",
    async run(tx, context, input) {
      return toCard(await sharedWrites(tx, context).archive("cards", input.id));
    },
  },
  unarchive: {
    kind: "operation",
    async run(tx, context, input) {
      return toCard(await sharedWrites(tx, context).unarchive("cards", input.id));
    },
  },
  delete: {
    kind: "operation",
    async run(tx, context, input) {
      return toCard(await sharedWrites(tx, context).softDelete("cards", input.id));
    },
  },
  restore: {
    kind: "operation",
    async run(tx, context, input) {
      return toCard(await sharedWrites(tx, context).restore("cards", input.id));
    },
  },
  active: {
    ...smallSetList(["cards"], async (tx, context) =>
      (await sharedEntry(tx, context).active("cards").selectAll().orderBy("id").execute()).map(
        toCard,
      ),
    ),
    active: true,
  },
  all: smallSetList(["cards"], async (tx, context) =>
    (await sharedEntry(tx, context).live("cards").selectAll().orderBy("id").execute()).map(toCard),
  ),
});
