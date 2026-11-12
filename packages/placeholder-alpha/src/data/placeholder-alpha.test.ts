import { createMigrationRunner } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { checkContract } from "@self-engine/storage/testing";
import { expect, test } from "vite-plus/test";
import { entryIdSchema } from "../contracts/index.ts";
import { placeholderAlpha } from "./index.ts";
import { entriesMigrations, entriesRowMap } from "./rows.ts";

// The kit's test context hands out these ids in order: the seed's live entry, then its deleted one.
const seededId = entryIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000");
const deletedId = entryIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000001");

test("the entries table follows the conventions and agrees with its row map", async () => {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, entriesMigrations).run();
    await expect(checkConventions(database)).resolves.toEqual([]);
    await expect(checkAgreement(entriesMigrations, entriesRowMap)).resolves.toEqual([]);
  } finally {
    await database.close();
  }
});

test("placeholder-alpha passes the storage contract kit", async () => {
  const { entries } = placeholderAlpha;
  await expect(
    checkContract(
      placeholderAlpha,
      async (tx, context) => {
        await entries.create.run(tx, context, { name: "Studio work" });
        const removed = await entries.create.run(tx, context, { name: "Old work" });
        await entries.delete.run(tx, context, { id: removed.id });
      },
      {
        list: {},
        create: { name: "Garden work" },
        rename: { id: seededId, name: "Studio hours" },
        delete: { id: seededId },
        restore: { id: deletedId },
      },
      {
        create: [{ input: { name: "Studio work" } }],
        rename: [
          {
            input: { id: seededId, name: "Taken" },
            prepare: async (tx, context) => {
              await entries.create.run(tx, context, { name: "Taken" });
            },
          },
        ],
        restore: [
          {
            input: { id: deletedId },
            prepare: async (tx, context) => {
              await entries.create.run(tx, context, { name: "Old work" });
            },
          },
        ],
      },
    ),
  ).resolves.toEqual([]);
});
