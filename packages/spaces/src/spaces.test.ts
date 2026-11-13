import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMigrationRunner, newId, type Database } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkAgreement, checkConventions, createTestSources } from "@self-engine/db/testing";
import { requireInstant } from "@self-engine/time/testing";
import type { KyselyPlugin } from "kysely";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { ensurePersonalSpace, spaceIdSchema, spacesMigrations, spacesRowMap } from "./index.ts";
import type { SpacesTables } from "./rows.ts";
import {
  createSpaceRows,
  FIRST_SPACE_ID,
  SECOND_SPACE_ID,
  testSpaceId,
  THIRD_SPACE_ID,
} from "./testing/index.ts";

const START = "2026-11-14T08:00:00.000Z";

const open: Database[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((database) => database.close()));
});

async function migrated(path = ":memory:"): Promise<Database> {
  const database = openDatabase(path);
  open.push(database);
  await createMigrationRunner(database, spacesMigrations).run();
  return database;
}

function spaceRows(database: Database) {
  return database.kysely
    .withTables<SpacesTables>()
    .selectFrom("spaces")
    .selectAll()
    .orderBy("id")
    .execute();
}

describe("the spaces table", () => {
  test("follows the conventions and agrees with its row map", async () => {
    const database = await migrated();
    await expect(checkConventions(database)).resolves.toEqual([]);
    await expect(checkAgreement(spacesMigrations, spacesRowMap)).resolves.toEqual([]);
  });

  test("rejects an update that breaks space_id = id, and accepts a rewrite of both", async () => {
    const database = await migrated();
    await createSpaceRows(database.kysely, [{ id: FIRST_SPACE_ID }, { id: SECOND_SPACE_ID }]);
    const spaces = database.kysely.withTables<SpacesTables>();
    await expect(
      spaces
        .updateTable("spaces")
        .set({ space_id: SECOND_SPACE_ID })
        .where("id", "=", FIRST_SPACE_ID)
        .execute(),
    ).rejects.toThrow(/CHECK constraint failed/);
    await spaces
      .updateTable("spaces")
      .set({ id: THIRD_SPACE_ID, space_id: THIRD_SPACE_ID })
      .where("id", "=", FIRST_SPACE_ID)
      .execute();
    expect((await spaceRows(database)).map(({ id, space_id }) => [id, space_id])).toEqual([
      [SECOND_SPACE_ID, SECOND_SPACE_ID],
      [THIRD_SPACE_ID, THIRD_SPACE_ID],
    ]);
  });

  test("leaves the kind to the row map: no CHECK on it, no unique index, no trigger", async () => {
    const database = await migrated();
    // The kind is a column the database takes as any text; only the row map knows the kinds.
    await database.kysely
      .withTables<{ spaces: Record<string, string | null> }>()
      .insertInto("spaces")
      .values({
        id: FIRST_SPACE_ID,
        created_at: START,
        updated_at: START,
        deleted_at: null,
        space_id: FIRST_SPACE_ID,
        kind: "organization",
      })
      .execute();
    await createSpaceRows(database.kysely, [{ id: SECOND_SPACE_ID }, { id: THIRD_SPACE_ID }]);
    const [unknown, ...personal] = await spaceRows(database);
    expect(spacesRowMap.spaces.safeParse(unknown).success).toBe(false);
    for (const row of personal) expect(spacesRowMap.spaces.safeParse(row).success).toBe(true);
    const schema = await database.kysely
      .withTables<{ sqlite_schema: { type: string; name: string; tbl_name: string } }>()
      .selectFrom("sqlite_schema")
      .select(["type", "name"])
      .where("tbl_name", "=", "spaces")
      .where("type", "in", ["index", "trigger"])
      .execute();
    // Only the index SQLite keeps for the primary key.
    expect(schema).toEqual([{ type: "index", name: "sqlite_autoindex_spaces_1" }]);
  });
});

describe("ensurePersonalSpace", () => {
  test("creates one Personal Space from the sources handed in on the first call", async () => {
    const database = await migrated();
    const sources = createTestSources(START);
    const expectedId = newId(createTestSources(START).ids);

    const space = await ensurePersonalSpace(database, sources);

    const now = requireInstant(START);
    expect(space).toEqual({ id: expectedId, createdAt: now, updatedAt: now, kind: "personal" });
    expect(spaceIdSchema.safeParse(space.id).success).toBe(true);
    expect(await spaceRows(database)).toEqual([
      {
        id: expectedId,
        created_at: START,
        updated_at: START,
        deleted_at: null,
        space_id: expectedId,
        kind: "personal",
      },
    ]);
  });

  test("returns the same Space on a second call and inserts nothing", async () => {
    const database = await migrated();
    const first = await ensurePersonalSpace(database, createTestSources(START));
    const rows = await spaceRows(database);

    const second = await ensurePersonalSpace(
      database,
      createTestSources("2026-11-15T08:00:00.000Z"),
    );

    expect(second).toEqual(first);
    expect(await spaceRows(database)).toEqual(rows);
  });

  test("fails on a database with two Personal Spaces and picks none", async () => {
    const database = await migrated();
    await createSpaceRows(database.kysely, [{ id: FIRST_SPACE_ID }, { id: SECOND_SPACE_ID }]);
    const rows = await spaceRows(database);

    await expect(ensurePersonalSpace(database, createTestSources(START))).rejects.toThrow(
      "2 Personal Spaces",
    );
    expect(await spaceRows(database)).toEqual(rows);
  });

  test("fails on a database whose Personal Space is deleted and creates none", async () => {
    const database = await migrated();
    await createSpaceRows(database.kysely, [
      { id: FIRST_SPACE_ID, deletedAt: requireInstant(START) },
    ]);
    const rows = await spaceRows(database);

    await expect(ensurePersonalSpace(database, createTestSources(START))).rejects.toThrow(
      "is deleted",
    );
    expect(await spaceRows(database)).toEqual(rows);
  });

  test("two connections on one file that both read none end with one and the same Space", async () => {
    const directory = mkdtempSync(join(tmpdir(), "self-engine-spaces-"));
    try {
      const path = join(directory, "data.sqlite");
      const first = await migrated(path);
      const second = openDatabase(path);
      open.push(second);

      // Holds the second connection right after its read: its snapshot has no Personal Space.
      let release = () => {};
      const released = new Promise<void>((resolve) => (release = resolve));
      let readNone = () => {};
      const hasRead = new Promise<void>((resolve) => (readNone = resolve));
      let paused = false;
      const pauseAfterFirstRead: KyselyPlugin = {
        transformQuery: ({ node }) => node,
        async transformResult({ result }) {
          if (!paused) {
            paused = true;
            readNone();
            await released;
          }
          return result;
        },
      };
      const late = ensurePersonalSpace(
        { ...second, kysely: second.kysely.withPlugin(pauseAfterFirstRead) },
        createTestSources("2026-11-14T08:00:00.500Z"),
      );
      await hasRead;

      // The first connection reads none too, inserts and commits while the second still waits.
      const early = await ensurePersonalSpace(first, createTestSources(START));
      release();

      // The second insert fails with SQLITE_BUSY_SNAPSHOT; the run once more finds the Space.
      await expect(late).resolves.toEqual(early);
      expect((await spaceRows(first)).map(({ id }) => id)).toEqual([early.id]);
    } finally {
      await Promise.all(open.splice(0).map((database) => database.close()));
      rmSync(directory, { recursive: true });
    }
  });
});

describe("the testing entry", () => {
  test("creates Space rows that pass the row map", async () => {
    const database = await migrated();
    const created = await createSpaceRows(database.kysely, [
      { id: FIRST_SPACE_ID },
      { id: SECOND_SPACE_ID, deletedAt: requireInstant(START) },
    ]);
    const rows = await spaceRows(database);
    expect(rows).toEqual(created);
    for (const row of rows) expect(spacesRowMap.spaces.parse(row)).toEqual(row);
  });

  test("creates rows inside an open transaction", async () => {
    const database = await migrated();
    await database.kysely.transaction().execute(async (tx) => {
      await createSpaceRows(tx, [{ id: THIRD_SPACE_ID }]);
    });
    expect((await spaceRows(database)).map(({ id }) => id)).toEqual([THIRD_SPACE_ID]);
  });

  test("numbers its fixed Space ids from one", () => {
    expect([FIRST_SPACE_ID, SECOND_SPACE_ID, THIRD_SPACE_ID]).toEqual([
      "00000000-0000-7000-8000-000000000001",
      "00000000-0000-7000-8000-000000000002",
      "00000000-0000-7000-8000-000000000003",
    ]);
    expect(testSpaceId(255)).toBe("00000000-0000-7000-8000-0000000000ff");
  });
});
