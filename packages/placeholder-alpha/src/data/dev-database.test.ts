// A dev database from before the foreign key to `spaces` (#252) starts after it: the table of
// `placeholder-alpha` is created again with the key, its old rows are dropped (D252), and the
// start ends ready with a Personal Space. On a file, as a dev database is.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMigrationRunner } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkConventions } from "@self-engine/db/testing";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { placeholderAlpha } from "./index.ts";
import { entriesMigrations } from "./rows.ts";

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

type Tables = {
  kysely_migration: { name: string };
  placeholder_alpha_entries: {
    id: string;
    created_at: string;
    updated_at: string;
    space_id: string;
    name: string;
  };
  spaces: { id: string; space_id: string; kind: string };
};

test("a dev database from before the foreign key to spaces starts ready with a Personal Space", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "self-engine-alpha-"));
  folders.push(folder);
  const file = path.join(folder, "data.sqlite");
  // The database as `main` left it before #252: the first migration only, no `spaces`, one row
  // under the fixed Space id the app carried then.
  const before = openDatabase(file);
  const firstOnly = entriesMigrations.filter(({ name }) => name === "placeholder-alpha/0001");
  await createMigrationRunner(before, firstOnly).run();
  await before.kysely
    .withTables<Tables>()
    .insertInto("placeholder_alpha_entries")
    .values({
      id: "01a1cfa1-0a00-7000-8000-000000000000",
      created_at: "2026-11-12T12:00:00.000Z",
      updated_at: "2026-11-12T12:00:00.000Z",
      space_id: "00000000-0000-7000-8000-000000000001",
      name: "Old work",
    })
    .execute();
  await before.close();

  const dataProcess = await startTestDataProcess({
    database: openDatabase(file),
    modules: { placeholderAlpha },
  });
  try {
    const tables = dataProcess.database.kysely.withTables<Tables>();
    const ran = await tables.selectFrom("kysely_migration").select("name").execute();
    expect(ran.map(({ name }) => name).sort()).toEqual([
      "placeholder-alpha/0001",
      "placeholder-alpha/0002",
      "spaces/0001",
    ]);
    // Only a ready start makes sure of the Personal Space.
    const spaces = await tables.selectFrom("spaces").select(["id", "space_id", "kind"]).execute();
    expect(spaces).toEqual([{ id: spaces[0]?.id, space_id: spaces[0]?.id, kind: "personal" }]);
    await expect(
      tables.selectFrom("placeholder_alpha_entries").selectAll().execute(),
    ).resolves.toEqual([]);
    await expect(checkConventions(dataProcess.database)).resolves.toEqual([]);
  } finally {
    await dataProcess.close();
  }
});
