import { createRouterClient } from "@orpc/server";
import { oc } from "@orpc/contract";
import type { TablesOf } from "@self-engine/db";
import { defineReason, type FrameReasons, refusal, targetDeleted } from "@self-engine/db/schema";
import type { KyselyPlugin } from "kysely";
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { cardIdSchema } from "../../test/cards-module/contracts/index.ts";
import { cards } from "../../test/cards-module/data/index.ts";
import { cardsRowMap } from "../../test/cards-module/data/rows.ts";
import { pinnedNote } from "../../test/notes-module/contracts/index.ts";
import { notes, pinnedNotesStay } from "../../test/notes-module/data/index.ts";
import { noteIdSchema, notesRowMap } from "../../test/notes-module/data/rows.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";
import {
  createContext,
  createFrame,
  defineStorageModule,
  noProtectionRules,
  protectionRule,
  protectionRules,
  referenceCheck,
  sharedWrites,
  type ProtectionRules,
  type RegisteredRule,
  type WriteKind,
} from "./index.ts";

type Database = Awaited<ReturnType<typeof createTestDatabase>>;
let database: Database;
afterEach(async () => {
  await database.close();
});

describe("the six write paths", () => {
  type CardRows = TablesOf<typeof cardsRowMap>;
  const kinds: readonly WriteKind[] = [
    "insert",
    "update",
    "delete",
    "restore",
    "archive",
    "unarchive",
  ];
  let asked: { write: WriteKind; rows: readonly object[] }[];
  let rules: ProtectionRules;

  beforeEach(async () => {
    database = await createTestDatabase(cards);
    asked = [];
    const silent = defineReason("never", z.object({}));
    rules = protectionRules([
      {
        rules: kinds.map((write) =>
          protectionRule(cardsRowMap, {
            table: "cards",
            write,
            reasons: [silent],
            async answer(_tx, _context, rows) {
              asked.push({ write, rows });
              return [];
            },
          }),
        ),
      },
      // A rule of another table: no write to `cards` may ask it.
      { rules: [{ ...pinnedNotesStay, write: "insert" }] },
    ]);
  });

  async function write(
    run: (writes: ReturnType<typeof sharedWrites<CardRows>>) => Promise<unknown>,
  ) {
    await database.kysely.transaction().execute(async (transaction) => {
      const context = createContext({ ...createTestContext(), rules });
      await run(sharedWrites(transaction.withTables<CardRows>(), context));
    });
  }

  test("each kind of write asks the rules of its table and kind, and no other", async () => {
    const id = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000001");
    await write((writes) => writes.insert("cards", id, { title: "First" }));
    await write((writes) => writes.update("cards", id, { title: "Second" }));
    await write((writes) => writes.archive("cards", id));
    await write((writes) => writes.unarchive("cards", id));
    await write((writes) => writes.softDelete("cards", id));
    await write((writes) => writes.restore("cards", id));

    expect(asked).toEqual([
      { write: "insert", rows: [{ id, values: { title: "First" } }] },
      { write: "update", rows: [{ id, values: { title: "Second" } }] },
      { write: "archive", rows: [{ id }] },
      { write: "unarchive", rows: [{ id }] },
      { write: "delete", rows: [{ id }] },
      { write: "restore", rows: [{ id }] },
    ]);
  });

  test("a row the write would not find stays not found, though every rule refuses it", async () => {
    const always = defineReason("always", z.object({}));
    rules = protectionRules([
      {
        rules: kinds.map((write) =>
          protectionRule(cardsRowMap, {
            table: "cards",
            write,
            reasons: [always],
            async answer(_tx, _context, rows) {
              return rows.map(({ id }) => ({ code: always.code, row: id, details: {} }));
            },
          }),
        ),
      },
    ]);
    const unknown = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000009");
    const live = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000001");
    const deleted = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000002");
    await database.kysely.transaction().execute(async (transaction) => {
      const context = createContext({ ...createTestContext(), rules: noProtectionRules });
      const writes = sharedWrites(transaction.withTables<CardRows>(), context);
      await writes.insert("cards", live, { title: "Live" });
      await writes.insert("cards", deleted, { title: "Deleted" });
      await writes.softDelete("cards", deleted);
    });
    const notFound = { code: "NOT_FOUND" };
    for (const id of [unknown, deleted]) {
      await expect(write((w) => w.update("cards", id, { title: "New" }))).rejects.toMatchObject(
        notFound,
      );
      await expect(write((w) => w.softDelete("cards", id))).rejects.toMatchObject(notFound);
      await expect(write((w) => w.archive("cards", id))).rejects.toMatchObject(notFound);
      await expect(write((w) => w.unarchive("cards", id))).rejects.toMatchObject(notFound);
    }
    for (const id of [unknown, live])
      await expect(write((w) => w.restore("cards", id))).rejects.toMatchObject(notFound);
    // A row the write finds is refused as before.
    await expect(write((w) => w.softDelete("cards", live))).rejects.toMatchObject({
      code: "REFUSED",
    });
  });

  test("an archive or unarchive that changes nothing answers with the row as it is, though every rule refuses it", async () => {
    const always = defineReason("always", z.object({}));
    rules = protectionRules([
      {
        rules: (["archive", "unarchive"] as const).map((write) =>
          protectionRule(cardsRowMap, {
            table: "cards",
            write,
            reasons: [always],
            async answer(_tx, _context, rows) {
              return rows.map(({ id }) => ({ code: always.code, row: id, details: {} }));
            },
          }),
        ),
      },
    ]);
    const active = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000001");
    const archived = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000002");
    const stored = await database.kysely.transaction().execute(async (transaction) => {
      const context = createContext({ ...createTestContext(), rules: noProtectionRules });
      const writes = sharedWrites(transaction.withTables<CardRows>(), context);
      return [
        await writes.insert("cards", active, { title: "Active" }),
        await writes
          .insert("cards", archived, { title: "Archived" })
          .then(() => writes.archive("cards", archived)),
      ];
    });
    const answered = await database.kysely.transaction().execute(async (transaction) => {
      const context = createContext({ ...createTestContext(), rules });
      const writes = sharedWrites(transaction.withTables<CardRows>(), context);
      return [await writes.unarchive("cards", active), await writes.archive("cards", archived)];
    });
    expect(answered).toEqual(stored);
    const refused = { code: "REFUSED" };
    await expect(write((w) => w.archive("cards", active))).rejects.toMatchObject(refused);
    await expect(write((w) => w.unarchive("cards", archived))).rejects.toMatchObject(refused);
  });

  test("an update that writes no field asks no rule", async () => {
    const id = cardIdSchema.parse("01a1c0a2-f079-7000-8000-000000000001");
    await write((writes) => writes.insert("cards", id, { title: "First" }));
    await write((writes) => writes.update("cards", id, {}));
    expect(asked.map((entry) => entry.write)).toEqual(["insert"]);
  });
});

describe("a module's rule", () => {
  let sources: ReturnType<typeof createTestContext>;
  beforeEach(async () => {
    database = await createTestDatabase(notes);
    sources = createTestContext();
  });

  function options(module: { readonly rules?: readonly RegisteredRule[] }) {
    return {
      database,
      sources: { ...sources, rules: protectionRules([module]) },
      checkOutputs: true,
    };
  }
  const client = (module: typeof notes) => createRouterClient(createFrame(module, options(module)));

  test("answers per row when it is handed several rows in one call", async () => {
    const pinned = await client(notes).create({ title: "Pinned", isPinned: true });
    const loose = await client(notes).create({ title: "Loose", isPinned: false });
    const answers = await database.kysely
      .transaction()
      .execute((transaction) =>
        pinnedNotesStay.answer(
          transaction.withTables<TablesOf<typeof notesRowMap>>(),
          createContext(createTestContext()),
          [{ id: pinned.id }, { id: loose.id }],
        ),
      );
    expect(answers).toEqual([{ code: "pinned", row: pinned.id, details: { title: "Pinned" } }]);
  });

  test("an unknown row is still not found", async () => {
    const id = noteIdSchema.parse("01a1c0a2-f079-7000-8000-000000000009");
    await expect(client(notes).delete({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // An Operation with several writes, each checked against what the earlier ones left (D332).
  const steps = defineStorageModule({
    name: "notes",
    contract: {
      create: notes.contract.create,
      renameThenDelete: oc
        .input(z.object({ id: noteIdSchema }))
        .output(z.null())
        .errors({ NOT_FOUND: {}, ...refusal }),
      unpinThenDelete: oc
        .input(z.object({ id: noteIdSchema }))
        .output(z.null())
        .errors({ NOT_FOUND: {}, ...refusal }),
      list: notes.contract.list,
    },
    migrations: notes.migrations,
    rowMap: notesRowMap,
    rules: [pinnedNotesStay],
  }).entries({
    create: notes.entries.create,
    list: notes.entries.list,
    renameThenDelete: {
      kind: "operation",
      async run(tx, context, input) {
        const writes = sharedWrites(tx, context);
        await writes.update("notes", input.id, { title: "Renamed" });
        await writes.softDelete("notes", input.id);
        return null;
      },
    },
    unpinThenDelete: {
      kind: "operation",
      async run(tx, context, input) {
        const writes = sharedWrites(tx, context);
        await writes.update("notes", input.id, { is_pinned: 0 });
        await writes.softDelete("notes", input.id);
        return null;
      },
    },
  });

  const stepsClient = () => createRouterClient(createFrame(steps, options(steps)));

  test("an Operation whose second write is refused writes nothing", async () => {
    const note = await stepsClient().create({ title: "Pinned", isPinned: true });
    await expect(stepsClient().renameThenDelete({ id: note.id })).rejects.toMatchObject({
      code: "REFUSED",
      data: { reasons: [{ code: "pinned", row: note.id, details: { title: "Renamed" } }] },
    });
    await expect(stepsClient().list({})).resolves.toEqual([note]);
  });

  test("sees what the Operation's earlier writes left", async () => {
    const note = await stepsClient().create({ title: "Pinned", isPinned: true });
    await expect(stepsClient().unpinThenDelete({ id: note.id })).resolves.toBeNull();
    await expect(stepsClient().list({})).resolves.toEqual([]);
  });

  test("a rule that writes or answers outside its Reasons is an unexpected error, not a Refusal", async () => {
    const reports: unknown[] = [];
    const broken = (answer: (typeof pinnedNotesStay)["answer"]) => ({
      ...notes,
      rules: [{ ...pinnedNotesStay, answer }],
    });
    const cases = [
      broken(async (tx) => {
        // Only a cast reaches a write; the plugin stops it at runtime.
        await (tx as unknown as Parameters<typeof notes.entries.create.run>[0])
          .deleteFrom("notes")
          .execute();
        return [];
      }),
      broken(async (_tx, _context, rows) =>
        rows.map((row) => ({ code: "other", row: row.id, details: { title: "x" } }) as never),
      ),
      broken(async (_tx, _context, rows) =>
        rows.map((row) => ({ code: "pinned", row: row.id, details: { title: 1 } }) as never),
      ),
    ];
    for (const module of cases) {
      const frame = createRouterClient(
        createFrame(module, {
          database,
          sources: { ...sources, rules: protectionRules([module]) },
          checkOutputs: true,
          report: (report) => reports.push(report),
        }),
      );
      const note = await frame.create({ title: `Note ${reports.length}`, isPinned: false });
      await expect(frame.delete({ id: note.id })).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
    }
    expect(reports).toHaveLength(3);
  });
});

test("a write to a table without a rule runs no additional query", async () => {
  database = await createTestDatabase(cards);
  const sources = createTestContext();
  let queries = 0;
  const counter: KyselyPlugin = {
    transformQuery({ node }) {
      queries++;
      return node;
    },
    transformResult: async ({ result }) => result,
  };
  async function countDelete(rules: ProtectionRules) {
    const frame = createRouterClient(
      createFrame(cards, {
        database: { ...database, kysely: database.kysely.withPlugin(counter) },
        sources: { ...sources, rules },
        checkOutputs: true,
      }),
    );
    const card = await frame.create({ title: `Card ${queries}` });
    const before = queries;
    await frame.delete({ id: card.id });
    return queries - before;
  }
  const withoutRules = await countDelete(protectionRules([]));
  // Rules of other tables and of other kinds of write on `cards` add nothing.
  const otherRules = await countDelete(
    protectionRules([
      { rules: [pinnedNotesStay] },
      {
        rules: [
          protectionRule(cardsRowMap, {
            table: "cards",
            write: "archive",
            reasons: [pinnedNote],
            answer: async () => [],
          }),
        ],
      },
    ]),
  );
  expect(otherRules).toBe(withoutRules);
});

describe("the types of a rule", () => {
  test("a rule's access cannot write", () => {
    protectionRule(notesRowMap, {
      table: "notes",
      write: "delete",
      reasons: [pinnedNote],
      async answer(tx) {
        // @ts-expect-error A rule reads through an access that has no write.
        tx.deleteFrom("notes");
        // @ts-expect-error A rule reads through an access that has no write.
        tx.updateTable("notes");
        return [];
      },
    });
  });

  test("a rule answers only with a Reason it names and with details of that Reason's shape", () => {
    protectionRule(notesRowMap, {
      table: "notes",
      write: "delete",
      reasons: [pinnedNote],
      answer: async (_tx, _context, rows) =>
        // @ts-expect-error `referenced` is not a Reason this rule names.
        rows.map((row) => ({ code: "referenced" as const, row: row.id, details: { title: "" } })),
    });
    protectionRule(notesRowMap, {
      table: "notes",
      write: "delete",
      reasons: [pinnedNote],
      answer: async (_tx, _context, rows) =>
        // @ts-expect-error The details of `pinned` carry a title.
        rows.map((row) => ({ code: pinnedNote.code, row: row.id, details: { count: 1 } })),
    });
  });

  test("a rule for insert and update receives the values, and only for its own table", () => {
    protectionRule(notesRowMap, {
      table: "notes",
      write: "update",
      reasons: [],
      async answer(_tx, _context, rows) {
        expectTypeOf(rows[0]!.values.title).toEqualTypeOf<string | undefined>();
        // @ts-expect-error The frame writes the convention columns itself.
        void rows[0]!.values.deleted_at;
        return [];
      },
    });
    protectionRule(notesRowMap, {
      table: "notes",
      write: "delete",
      reasons: [],
      async answer(_tx, _context, rows) {
        // @ts-expect-error A delete hands over no values.
        void rows[0]!.values;
        return [];
      },
    });
    protectionRule(notesRowMap, {
      // @ts-expect-error A rule belongs to a table of its row map.
      table: "cards",
      write: "delete",
      reasons: [],
      answer: async () => [],
    });
  });
});

describe("the Reasons a rule answers with stay in the types (D334)", () => {
  test("a module keeps the Reasons of its rules, so the page can ask a text for each", () => {
    type ModuleReasons = NonNullable<(typeof notes)["rules"]>[number]["reasons"][number];
    expectTypeOf<ModuleReasons>().toEqualTypeOf<typeof pinnedNote>();
  });

  test("a module's rule answers only with the Reasons it declares, also without `protectionRule`", () => {
    const { rules: _rules, ...withoutRules } = notes;
    defineStorageModule({
      ...withoutRules,
      rules: [
        {
          table: "notes",
          write: "delete",
          reasons: [pinnedNote],
          // @ts-expect-error `target_deleted` is not a Reason this rule declares.
          answer: async () => [
            { code: targetDeleted.code, row: "n1", details: { target: { table: "x", id: "y" } } },
          ],
        },
      ],
    });
  });

  test("each rule of a module answers only with its own Reasons, not with another rule's", () => {
    const { rules: _rules, ...withoutRules } = notes;
    const target = { target: { table: "x", id: "y" } };
    defineStorageModule({
      ...withoutRules,
      rules: [
        {
          table: "notes",
          write: "delete",
          reasons: [pinnedNote],
          // @ts-expect-error `target_deleted` is the update rule's Reason, not this rule's.
          answer: async () => [{ code: targetDeleted.code, row: "n1", details: target }],
        },
        {
          table: "notes",
          write: "update",
          reasons: [targetDeleted],
          answer: async () => [{ code: targetDeleted.code, row: "n1", details: target }],
        },
      ],
    });
  });

  test("a module whose rules declare different Reasons keeps them all", () => {
    const { rules: _rules, ...withoutRules } = notes;
    const module = defineStorageModule({
      ...withoutRules,
      rules: [
        pinnedNotesStay,
        protectionRule(notesRowMap, {
          table: "notes",
          write: "update",
          reasons: [targetDeleted],
          answer: async () => [],
        }),
      ],
    }).entries(notes.entries);
    type ModuleReasons = NonNullable<(typeof module)["rules"]>[number]["reasons"][number];
    expectTypeOf<ModuleReasons>().toEqualTypeOf<typeof pinnedNote | typeof targetDeleted>();
  });

  test("the reference check answers only with the frame's Reasons", () => {
    type CheckReasons = ReturnType<typeof referenceCheck>["rules"][number]["reasons"][number];
    expectTypeOf<CheckReasons>().toEqualTypeOf<FrameReasons>();
  });
});
