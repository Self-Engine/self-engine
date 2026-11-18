import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { openDatabase } from "../better-sqlite3/index.ts";
import type { Database } from "./database.ts";
import { referencesOf } from "./introspect.ts";

let database: Database;

beforeEach(() => {
  database = openDatabase(":memory:");
});

afterEach(async () => {
  await database.close();
});

test("a reference names its target as SQLite resolves it, which folds only ASCII letters", async () => {
  await database.executeScript(`
    CREATE TABLE "Ärzte" (id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE "ärzte" (id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE visits (
      id TEXT PRIMARY KEY,
      upper_id TEXT REFERENCES "ÄRZTE" (ID),
      lower_id TEXT REFERENCES "äRZTE" (id)
    ) STRICT;
  `);

  const references = await referencesOf(database);
  expect(references).toHaveLength(2);
  expect(references).toEqual(
    expect.arrayContaining([
      { table: "visits", column: "upper_id", target: "Ärzte" },
      { table: "visits", column: "lower_id", target: "ärzte" },
    ]),
  );
});
