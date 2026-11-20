import { createMigrationRunner, type Database } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { defineSetting } from "@self-engine/settings";
import { spacesMigrations } from "@self-engine/spaces";
import { createSpaceRows, FIRST_SPACE_ID, SECOND_SPACE_ID } from "@self-engine/spaces/testing";
import { z } from "zod/mini";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { readSetting, settingsMigrations, settingsRowMap, type SettingsTables } from "./index.ts";
import { createSettingRows } from "./testing/index.ts";

const open: Database[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((database) => database.close()));
});

/** A database as every Data Process starts it: `spaces`, then `settings`, with the first Space. */
async function migrated(): Promise<Database> {
  const database = openDatabase(":memory:");
  open.push(database);
  await createMigrationRunner(database, [...spacesMigrations, ...settingsMigrations]).run();
  await createSpaceRows(database.kysely, [{ id: FIRST_SPACE_ID }, { id: SECOND_SPACE_ID }]);
  return database;
}

const workHours = defineSetting({
  key: "fixture.workHours",
  scope: "synced",
  default: 8,
  schema: z.number().check(z.int(), z.positive()),
});

const compact = defineSetting({
  key: "fixture.compact",
  scope: "device",
  default: false,
  schema: z.boolean(),
});

function settingRows(database: Database) {
  return database.kysely
    .withTables<SettingsTables>()
    .selectFrom("settings")
    .selectAll()
    .orderBy("id")
    .execute();
}

describe("the settings table", () => {
  test("follows the conventions and agrees with its row map", async () => {
    const database = await migrated();
    await expect(checkConventions(database)).resolves.toEqual([]);
    await expect(checkAgreement(settingsMigrations, settingsRowMap)).resolves.toEqual([]);
  });

  test("holds one live row per Space and key", async () => {
    const database = await migrated();
    await createSettingRows(database.kysely, [
      { key: workHours.key, value: 6 },
      { key: workHours.key, value: 7, spaceId: SECOND_SPACE_ID },
    ]);
    await expect(
      createSettingRows(database.kysely, [{ key: workHours.key, value: 9 }]),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });
});

describe("readSetting", () => {
  test("answers with the stored value of the Space", async () => {
    const database = await migrated();
    await createSettingRows(database.kysely, [
      { key: workHours.key, value: 6 },
      { key: workHours.key, value: 7, spaceId: SECOND_SPACE_ID },
    ]);

    await expect(readSetting(database.kysely, FIRST_SPACE_ID, workHours)).resolves.toBe(6);
    await expect(readSetting(database.kysely, SECOND_SPACE_ID, workHours)).resolves.toBe(7);
  });

  test.each([
    { row: "is missing", rows: [] },
    { row: "fails the schema", rows: [{ key: workHours.key, value: -2 }] },
    { row: "is no JSON", rows: [{ key: workHours.key, text: "{eight" }] },
    {
      row: "is another Space's",
      rows: [{ key: workHours.key, value: 6, spaceId: SECOND_SPACE_ID }],
    },
  ])("answers with the default when the row $row, and writes nothing", async ({ rows }) => {
    const database = await migrated();
    await createSettingRows(database.kysely, rows);
    const before = await settingRows(database);

    await expect(readSetting(database.kysely, FIRST_SPACE_ID, workHours)).resolves.toBe(8);

    expect(await settingRows(database)).toEqual(before);
  });

  test("sees a row its own transaction wrote and not yet committed", async () => {
    const database = await migrated();
    const read = await database.kysely.transaction().execute(async (tx) => {
      await createSettingRows(tx, [{ key: workHours.key, value: 5 }]);
      return readSetting(tx, FIRST_SPACE_ID, workHours);
    });
    expect(read).toBe(5);
  });

  test("takes only a Synced Setting", async () => {
    const database = await migrated();
    // @ts-expect-error A Device Setting stays on its device; the database holds none.
    await expect(readSetting(database.kysely, FIRST_SPACE_ID, compact)).resolves.toBe(false);
  });
});
