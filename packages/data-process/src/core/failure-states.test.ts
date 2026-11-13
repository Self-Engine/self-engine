// The core over Node's MessageChannel (no Electron) when its migrations cannot run: it keeps
// answering `health` with the reason instead of dying (spec #29).

import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { createMigrationRunner, type Database, type Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { sql } from "kysely";
import { afterEach, expect, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

function createTable(name: string, table: string): Migration {
  return { name, sql: `CREATE TABLE ${table} (id TEXT PRIMARY KEY) STRICT;` };
}

const started: TestDataProcess[] = [];

afterEach(async () => {
  for (const dataProcess of started.splice(0)) await dataProcess.close();
});

async function start(
  options: Parameters<typeof startTestDataProcess>[0],
): Promise<ContractRouterClient<ProtocolContract>> {
  const dataProcess = await startTestDataProcess(options);
  started.push(dataProcess);
  return createORPCClient(new RPCLink({ port: dataProcess.openPort() }));
}

/** Every table and index with its SQL and every recorded migration: what "unchanged" means. */
async function snapshot(database: Database): Promise<unknown> {
  const schema = await sql`SELECT type, name, sql FROM sqlite_master ORDER BY name`.execute(
    database.kysely,
  );
  const ran = await sql`SELECT name FROM kysely_migration ORDER BY name`.execute(database.kysely);
  return { schema: schema.rows, ran: ran.rows };
}

test("a failing migration surfaces as migrationFailed naming it, and the database is unchanged", async () => {
  const database = openDatabase(":memory:");
  const time = createTable("time/0001", "time_entries");
  await createMigrationRunner(database, [time]).run();
  const before = await snapshot(database);

  const client = await start({
    database,
    migrations: [
      time,
      createTable("finance/0001", "invoices"),
      { name: "time/0002", sql: "CREATE TABLE half (id TEXT) STRICT; THIS IS NOT SQL;" },
    ],
  });

  await expect(client.health()).resolves.toEqual({
    state: "migrationFailed",
    migration: "time/0002",
  });
  await expect(snapshot(database)).resolves.toEqual(before);
});

test("a database that ran a migration this app does not know surfaces as databaseNewer naming it", async () => {
  const database = openDatabase(":memory:");
  const time = createTable("time/0001", "time_entries");
  await createMigrationRunner(database, [time, createTable("time/0002", "time_breaks")]).run();

  const client = await start({ database, migrations: [time] });

  await expect(client.health()).resolves.toEqual({
    state: "databaseNewer",
    migration: "time/0002",
  });
});

test("in a failure state the tablesChanged stream is refused with SERVICE_UNAVAILABLE carrying the health", async () => {
  const client = await start({
    migrations: [{ name: "time/0001", sql: "THIS IS NOT SQL;" }],
  });

  const refusal = (async () => {
    const events = await client.tablesChanged();
    await events.next();
  })();

  await expect(refusal).rejects.toBeInstanceOf(ORPCError);
  await expect(refusal).rejects.toMatchObject({
    code: "SERVICE_UNAVAILABLE",
    data: { state: "migrationFailed", migration: "time/0001" },
  });
});
