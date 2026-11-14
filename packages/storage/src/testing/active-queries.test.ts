import { expect, test } from "vite-plus/test";
import { cards } from "../../test/cards-module/data/index.ts";
import { cardIdSchema } from "../../test/cards-module/contracts/index.ts";
import { notes } from "../../test/notes-module/data/index.ts";
import { defineStorageModule, sharedEntry, smallSetList } from "../core/index.ts";
import { toCard } from "../../test/cards-module/data/rows.ts";
import { checkContract, type Seed } from "./index.ts";

const LIVE = cardIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000");
const ARCHIVED = cardIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000001");
const DELETED = cardIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000002");

const seed: Seed<typeof cards.rowMap> = async (tx, context) => {
  const { create, archive, delete: remove } = cards.entries;
  await create.run(tx, context, { title: "Open" });
  const shelved = await create.run(tx, context, { title: "Shelved" });
  await archive.run(tx, context, { id: shelved.id });
  const removed = await create.run(tx, context, { title: "Deleted" });
  await remove.run(tx, context, { id: removed.id });
};

const examples = {
  get: { id: ARCHIVED },
  create: { title: "New" },
  archive: { id: LIVE },
  unarchive: { id: ARCHIVED },
  delete: { id: ARCHIVED },
  restore: { id: DELETED },
  active: {},
  all: {},
};

test("cards, whose active Query leaves out archived rows, passes the kit", async () => {
  await expect(checkContract(cards, seed, examples)).resolves.toEqual([]);
});

test("the kit fails an active Query that returns an archived row", async () => {
  const forgetful = defineStorageModule({
    name: cards.name,
    contract: cards.contract,
    migrations: cards.migrations,
    rowMap: cards.rowMap,
  }).entries({
    ...cards.entries,
    active: {
      ...smallSetList(["cards"], async (tx, context) =>
        (await sharedEntry(tx, context).live("cards").selectAll().orderBy("id").execute()).map(
          toCard,
        ),
      ),
      active: true,
    },
  });
  await expect(checkContract(forgetful, seed, examples)).resolves.toEqual([
    { entry: "active", rule: "active query returns an archived row" },
  ]);
});

test("the kit fails a Query declared active in a module without an archivable table", async () => {
  const misdeclared = {
    ...notes,
    contract: { list: notes.contract.list },
    entries: { list: { ...notes.entries.list, active: true as const } },
  };
  await expect(
    checkContract(
      misdeclared,
      async (tx, context) => {
        await notes.entries.create.run(tx, context, { title: "Seed", isPinned: false });
      },
      { list: {} },
    ),
  ).resolves.toEqual([{ entry: "list", rule: "active query has no archivable table" }]);
});
