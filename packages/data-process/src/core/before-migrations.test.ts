// The core offers one point before its migrations run, only when some are pending, for the
// backup of #35 (D94, D138).

import { createMigrationRunner, type Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { settingsMigrations } from "@self-engine/settings-rows";
import { spacesMigrations } from "@self-engine/spaces";
import { sql } from "kysely";
import { afterEach, expect, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

const time: Migration = {
  name: "time/0001",
  sql: "CREATE TABLE time_entries (id TEXT PRIMARY KEY) STRICT;",
};

const started: TestDataProcess[] = [];

afterEach(async () => {
  for (const dataProcess of started.splice(0)) await dataProcess.close();
});

test("calls the hook before the pending migrations run", async () => {
  const database = openDatabase(":memory:");
  const tablesSeenByHook: string[][] = [];

  started.push(
    await startTestDataProcess({
      database,
      migrations: [time],
      async beforeMigrations() {
        const { rows } = await sql<{ name: string }>`
          SELECT name FROM sqlite_master WHERE name = 'time_entries'
        `.execute(database.kysely);
        tablesSeenByHook.push(rows.map(({ name }) => name));
      },
    }),
  );

  expect(tablesSeenByHook).toEqual([[]]);
});

test("does not call the hook when no migration is pending", async () => {
  const database = openDatabase(":memory:");
  // The migrations of `spaces` and `settings` run at every start, so an earlier start ran them too.
  await createMigrationRunner(database, [...spacesMigrations, ...settingsMigrations, time]).run();
  let calls = 0;

  started.push(
    await startTestDataProcess({
      database,
      migrations: [time],
      beforeMigrations() {
        calls += 1;
      },
    }),
  );

  expect(calls).toBe(0);
});
