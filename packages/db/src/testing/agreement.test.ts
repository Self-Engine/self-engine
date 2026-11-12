import { expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import type { TablesOf } from "../core/index.ts";
import { checkAgreement } from "./index.ts";

const migrations = [{ name: "test/0001", sql: "CREATE TABLE notes (body TEXT NOT NULL) STRICT;" }];

test("reports a SQL column missing from the row map", async () => {
  await expect(checkAgreement(migrations, { notes: z.object({}) })).resolves.toEqual([
    { table: "notes", column: "body", rule: "column must have a row map field" },
  ]);
});

test("reports a row field missing from SQL", async () => {
  await expect(
    checkAgreement(migrations, { notes: z.object({ body: z.string(), title: z.string() }) }),
  ).resolves.toEqual([
    { table: "notes", column: "title", rule: "row map field must have a column" },
  ]);
});

test("reports a table missing from the row map", async () => {
  await expect(checkAgreement(migrations, {})).resolves.toEqual([
    { table: "notes", rule: "table must have a row map entry" },
  ]);
});

test("reports a row map entry missing from SQL", async () => {
  await expect(checkAgreement([], { notes: z.object({ body: z.string() }) })).resolves.toEqual([
    { table: "notes", rule: "row map entry must have a table" },
  ]);
});

test("reports a field whose type disagrees with its SQL column", async () => {
  await expect(
    checkAgreement(migrations, { notes: z.object({ body: z.number() }) }),
  ).resolves.toEqual([
    { table: "notes", column: "body", rule: "field must use a string schema for TEXT" },
  ]);
});

test.each([
  ["TEXT NOT NULL", z.string().nullable(), "field must not be nullable"],
  ["TEXT", z.string(), "field must be nullable"],
])("reports wrong nullability for %s", async (definition, field, rule) => {
  await expect(
    checkAgreement(
      [{ name: "test/0001", sql: `CREATE TABLE notes (body ${definition}) STRICT;` }],
      { notes: z.object({ body: field }) },
    ),
  ).resolves.toEqual([{ table: "notes", column: "body", rule }]);
});

test("rejects optional fields", async () => {
  await expect(
    checkAgreement(migrations, { notes: z.object({ body: z.string().optional() }) }),
  ).resolves.toEqual([{ table: "notes", column: "body", rule: "field must not be optional" }]);
});

test("rejects boolean schemas with a pointer to sqliteBoolean", async () => {
  await expect(
    checkAgreement(
      [{ name: "test/0001", sql: "CREATE TABLE notes (body INTEGER NOT NULL) STRICT;" }],
      { notes: z.object({ body: z.boolean() }) },
    ),
  ).resolves.toEqual([
    { table: "notes", column: "body", rule: "use sqliteBoolean instead of z.boolean()" },
  ]);
});

test("rejects unsupported forms", async () => {
  await expect(
    checkAgreement(migrations, { notes: z.object({ body: z.date() }) }),
  ).resolves.toEqual([
    {
      table: "notes",
      column: "body",
      rule: "unsupported field form; use a string, number, integer or sqliteBoolean schema",
    },
  ]);
});

test.each([
  ["INTEGER", z.number(), "field must use an integer schema or sqliteBoolean for INTEGER"],
  ["REAL", z.number().int(), "field must use a number schema for REAL"],
  ["BLOB", z.string(), "unsupported SQLite type BLOB"],
])("reports wrong type for %s", async (type, field, rule) => {
  await expect(
    checkAgreement(
      [{ name: "test/0001", sql: `CREATE TABLE notes (body ${type} NOT NULL) STRICT;` }],
      { notes: z.object({ body: field }) },
    ),
  ).resolves.toEqual([{ table: "notes", column: "body", rule }]);
});

test("accepts matching forms, brands, nullable fields and an external foreign key", async () => {
  const { idSchema, sqliteBoolean } = await import("../schema/index.ts");
  await expect(
    checkAgreement(
      [
        {
          name: "test/0001",
          sql: `
    CREATE TABLE notes (
      id TEXT PRIMARY KEY NOT NULL,
      body TEXT NOT NULL,
      count INTEGER NOT NULL,
      score REAL NOT NULL,
      done INTEGER NOT NULL CHECK (done IN (0, 1)),
      project_id TEXT REFERENCES projects (id),
      deleted_at TEXT
    ) STRICT;
  `,
        },
      ],
      {
        notes: z.object({
          id: idSchema("Note"),
          body: z.string().min(1).brand<"Body">(),
          count: z.number().int().positive().brand<"Count">(),
          score: z.number(),
          done: sqliteBoolean,
          project_id: idSchema("Project").nullable(),
          deleted_at: z.iso.datetime().nullable(),
        }),
      },
    ),
  ).resolves.toEqual([]);
});

test("derives a withTables-compatible map and preserves brands in query results", async () => {
  const { openDatabase } = await import("../better-sqlite3/index.ts");
  const { idSchema } = await import("../schema/index.ts");
  const rowMap = { notes: z.object({ id: idSchema("Note"), body: z.string().brand<"Body">() }) };
  const database = openDatabase(":memory:");
  try {
    const query = database.kysely
      .withTables<TablesOf<typeof rowMap>>()
      .selectFrom("notes")
      .selectAll();
    expectTypeOf<Awaited<ReturnType<typeof query.execute>>>().toEqualTypeOf<
      z.output<typeof rowMap.notes>[]
    >();
    expectTypeOf<TablesOf<typeof rowMap>["notes"]["id"]>().toEqualTypeOf<
      string & z.$brand<"NoteId">
    >();
  } finally {
    await database.close();
  }
});

test.each([
  ["an optional nullable field", z.string().optional().nullable(), "field must not be optional"],
  ["a nullable optional field", z.string().nullable().optional(), "field must not be optional"],
  [
    "a transform",
    z
      .string()
      .transform((value) => value.length)
      .nullable(),
    "unsupported field form; use a string, number, integer or sqliteBoolean schema",
  ],
  [
    "a default",
    z.string().default("").nullable(),
    "unsupported field form; use a string, number, integer or sqliteBoolean schema",
  ],
])("rejects %s", async (_name, field, rule) => {
  await expect(
    checkAgreement([{ name: "test/0001", sql: "CREATE TABLE notes (body TEXT) STRICT;" }], {
      notes: z.object({ body: field }),
    }),
  ).resolves.toEqual([{ table: "notes", column: "body", rule }]);
});

test("ignores bookkeeping and views but checks similar table names and later migrations", async () => {
  await expect(
    checkAgreement(
      [
        {
          name: "test/0001",
          sql: `
      CREATE TABLE local_counter (n INTEGER PRIMARY KEY AUTOINCREMENT);
      CREATE TABLE kysely_migration_notes (body TEXT NOT NULL) STRICT;
      CREATE VIEW note_view AS SELECT body FROM kysely_migration_notes;
      ANALYZE;
    `,
        },
        { name: "test/0002", sql: "ALTER TABLE kysely_migration_notes ADD COLUMN title TEXT;" },
      ],
      {
        local_counter: z.object({ n: z.number().int().nullable() }),
        kysely_migration_notes: z.object({ body: z.string(), title: z.string().nullable() }),
      },
    ),
  ).resolves.toEqual([]);
});

test("checks generated columns too", async () => {
  await expect(
    checkAgreement(
      [
        {
          name: "test/0001",
          sql: "CREATE TABLE notes (body TEXT NOT NULL, size INTEGER GENERATED ALWAYS AS (length(body))) STRICT;",
        },
      ],
      { notes: z.object({ body: z.string() }) },
    ),
  ).resolves.toEqual([
    { table: "notes", column: "size", rule: "column must have a row map field" },
  ]);
});
