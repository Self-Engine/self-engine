import type { TablesOf } from "@self-engine/db";
import { defineReason } from "@self-engine/db/schema";
import { afterEach, expect, test } from "vite-plus/test";
import { z } from "zod";
import { cardIdSchema } from "../../test/cards-module/contracts/index.ts";
import { cards } from "../../test/cards-module/data/index.ts";
import { cardsRowMap } from "../../test/cards-module/data/rows.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";
import {
  clearance,
  createContext,
  protectionRule,
  protectionRules,
  sharedWrites,
  type ClearanceWrite,
  type WriteKind,
} from "./index.ts";

type CardRows = TablesOf<typeof cardsRowMap>;
type Database = Awaited<ReturnType<typeof createTestDatabase>>;
let database: Database;
afterEach(async () => {
  await database.close();
});

// Every kind of write on `cards` is blocked by a rule that also records what it was asked.
const locked = defineReason("locked", z.object({}));
const asked: { write: WriteKind; rows: readonly object[] }[] = [];
const rules = protectionRules([
  {
    rules: (["update", "delete", "restore", "archive", "unarchive"] as const).map((write) =>
      protectionRule(cardsRowMap, {
        table: "cards",
        write,
        reasons: [locked],
        async answer(_tx, _context, rows) {
          asked.push({ write, rows });
          return rows.map(({ id }) => ({ code: locked.code, row: id, details: {} }));
        },
      }),
    ),
  },
]);

test("archive and unarchive of a Live Row, archived or not, ask their rules; an update is asked without values", async () => {
  database = await createTestDatabase(cards);
  asked.length = 0;
  const id = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000001");
  await database.kysely
    .transaction()
    .execute((transaction) =>
      sharedWrites(transaction.withTables<CardRows>(), createContext(createTestContext())).insert(
        "cards",
        id,
        { title: "Archived" },
      ),
    );
  await database.kysely
    .transaction()
    .execute((transaction) =>
      sharedWrites(transaction.withTables<CardRows>(), createContext(createTestContext())).archive(
        "cards",
        id,
      ),
    );
  const writes: ClearanceWrite[] = ["update", "archive", "unarchive"];

  const answer = await database.kysely
    .transaction()
    .execute((transaction) =>
      clearance(
        transaction.withTables<CardRows>(),
        createContext({ ...createTestContext(), rules }),
        "cards",
        writes,
        [id],
      ),
    );

  const blocked = {
    state: "blocked",
    reasons: [{ code: "locked", severity: "blocking", table: "cards", row: id, details: {} }],
  };
  expect(answer).toEqual([
    { row: id, writes: { update: blocked, archive: blocked, unarchive: blocked } },
  ]);
  expect(asked).toEqual([
    { write: "update", rows: [{ id, values: {} }] },
    { write: "archive", rows: [{ id }] },
    { write: "unarchive", rows: [{ id }] },
  ]);
});
