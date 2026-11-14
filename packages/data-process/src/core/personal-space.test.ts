// The start makes sure of the Personal Space after its migrations, and every call's context
// carries it (D195, D287, #251). Through the test helper, as an app starts the core.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { createMigrationRunner, type Database, type Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { spacesMigrations } from "@self-engine/spaces";
import { createSpaceRows, FIRST_SPACE_ID, SECOND_SPACE_ID } from "@self-engine/spaces/testing";
import { notes } from "@self-engine/storage/testing";
import { requireInstant } from "@self-engine/time/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

type Client = ContractRouterClient<ProtocolContract & { notes: typeof notes.contract }>;

const started: TestDataProcess[] = [];
const folders: string[] = [];

afterEach(async () => {
  for (const dataProcess of started.splice(0)) await dataProcess.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

async function start(database: Database): Promise<Client> {
  const dataProcess = await startTestDataProcess({ database, modules: { notes } });
  started.push(dataProcess);
  return createORPCClient(new RPCLink({ port: dataProcess.openPort() }));
}

/** The rows of `spaces` and the Space of each note, as the tables hold them. */
async function stored(database: Database) {
  const tables = database.kysely.withTables<{
    spaces: { id: string; space_id: string; kind: string; deleted_at: string | null };
    notes: { id: string; space_id: string };
  }>();
  return {
    spaces: await tables.selectFrom("spaces").select(["id", "space_id", "kind"]).execute(),
    notes: await tables.selectFrom("notes").select(["id", "space_id"]).execute(),
  };
}

async function spaceCount(database: Database): Promise<number> {
  const rows = await database.kysely
    .withTables<{ spaces: { id: string } }>()
    .selectFrom("spaces")
    .select("id")
    .execute();
  return rows.length;
}

function databaseFile(): string {
  const folder = mkdtempSync(path.join(tmpdir(), "self-engine-space-"));
  folders.push(folder);
  return path.join(folder, "data.sqlite");
}

test("on a fresh database a call works at once, and its row carries the Space in the table", async () => {
  const database = openDatabase(":memory:");
  const client = await start(database);

  const note = await client.notes.create({ title: "First", isPinned: false });

  const { spaces, notes: rows } = await stored(database);
  expect(spaces).toHaveLength(1);
  const [space] = spaces;
  expect(space).toMatchObject({ kind: "personal", space_id: space?.id });
  // The Space comes from the table, not from a fixed id of the code or of a test.
  expect([FIRST_SPACE_ID, SECOND_SPACE_ID]).not.toContain(space?.id);
  expect(rows).toEqual([{ id: note.id, space_id: space?.id }]);
});

test("a second start on the same database uses the same Space and sees the row", async () => {
  const file = databaseFile();
  const first = await startTestDataProcess({ database: openDatabase(file), modules: { notes } });
  const firstClient: Client = createORPCClient(new RPCLink({ port: first.openPort() }));
  const note = await firstClient.notes.create({ title: "Kept", isPinned: false });
  const before = await stored(first.database);
  await first.close();

  const database = openDatabase(file);
  const client = await start(database);

  await expect(client.notes.list({})).resolves.toEqual([note]);
  expect(await stored(database)).toEqual(before);
});

test.each([
  {
    broken: "two Personal Spaces",
    rows: [{ id: FIRST_SPACE_ID }, { id: SECOND_SPACE_ID }],
    message: "2 Personal Spaces",
  },
  {
    broken: "a deleted Personal Space",
    rows: [{ id: FIRST_SPACE_ID, deletedAt: requireInstant("2026-01-02T00:00:00.000Z") }],
    message: "is deleted",
  },
])("a database with $broken does not start", async ({ rows, message }) => {
  const database = openDatabase(":memory:");
  try {
    await createMigrationRunner(database, [...spacesMigrations, ...notes.migrations]).run();
    await createSpaceRows(database.kysely, rows);

    await expect(startTestDataProcess({ database, modules: { notes } })).rejects.toThrow(message);
    expect(await spaceCount(database)).toBe(rows.length);
  } finally {
    await database.close();
  }
});

const time: Migration = {
  name: "time/0001",
  sql: "CREATE TABLE time_entries (id TEXT PRIMARY KEY) STRICT;",
};

test.each([
  {
    state: "migrationFailed",
    known: [time, { name: "time/0002", sql: "THIS IS NOT SQL;" }],
    ran: [time],
  },
  {
    state: "databaseNewer",
    known: [time],
    ran: [time, { name: "time/0002", sql: "CREATE TABLE time_breaks (id TEXT) STRICT;" }],
  },
])("a start that ends in $state reports it and creates no Space", async ({ state, known, ran }) => {
  const database = openDatabase(":memory:");
  // The table of `spaces` exists from an earlier start, so only the start can have left it empty.
  await createMigrationRunner(database, [...spacesMigrations, ...ran]).run();
  const dataProcess = await startTestDataProcess({ database, migrations: known });
  started.push(dataProcess);
  const client: ContractRouterClient<ProtocolContract> = createORPCClient(
    new RPCLink({ port: dataProcess.openPort() }),
  );

  await expect(client.health()).resolves.toEqual({ state, migration: "time/0002" });
  expect(await spaceCount(database)).toBe(0);
});

test("a failed first migration leaves no table of Spaces and no Space", async () => {
  const dataProcess = await startTestDataProcess({
    migrations: [{ name: "time/0001", sql: "THIS IS NOT SQL;" }],
  });
  started.push(dataProcess);

  await expect(spaceCount(dataProcess.database)).rejects.toThrow("no such table: spaces");
});
