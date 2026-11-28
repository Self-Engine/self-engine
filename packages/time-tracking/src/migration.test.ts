// A database that ran the merged migrations of `time-tracking` moves to the shape of ADR 0044 at
// the next start: the hook that takes the Backup runs first, the stored Time Entries of the old
// shape are dropped, and a running Timer survives.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { timeTracking } from "./data/index.ts";
import { timeTrackingMigrations } from "./data/rows.ts";

type Client = ContractRouterClient<
  ProtocolContract & {
    projects: typeof projects.contract;
    timeTracking: typeof timeTracking.contract;
    settings: typeof settings.contract;
  }
>;

let folder = "";
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "time-tracking-migration-"));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

/** The module as the merged migrations left it: without the migration of ADR 0044. */
const merged = {
  ...timeTracking,
  migrations: timeTrackingMigrations.filter(({ name }) => name !== "time-tracking/0003"),
};

/** Counts the rows of `time_entries`, whatever shape the table has. */
async function storedEntries(database: ReturnType<typeof openDatabase>) {
  const rows = await database.kysely
    .withTables<{ time_entries: { id: string } }>()
    .selectFrom("time_entries")
    .select("id")
    .execute();
  return rows.length;
}

test("a database of the merged migrations with an entry and a running Timer moves forward at the next start, after the Backup", async () => {
  const path = join(folder, "self-engine.sqlite");
  const sources = createTestSources("2026-11-16T09:00:00.000Z");

  // The app as it was: a running Timer, and an entry in the old shape.
  const before = await startTestDataProcess({
    modules: { projects, timeTracking: merged, settings },
    database: openDatabase(path),
    sources,
  });
  const old: Client = createORPCClient(new RPCLink({ port: before.openPort() }));
  const { timer } = await old.timeTracking.startTimer({ note: "Design" });
  await before.database.executeScript(`
    INSERT INTO time_entries
      (id, created_at, updated_at, space_id, started_at, ended_at, duration_seconds, time_zone)
    SELECT '01a1cfa1-0e00-7000-8000-000000000001', started_at, started_at, space_id,
      '2026-11-15T08:00:00.000Z', '2026-11-15T09:00:00.000Z', 3600, 'Europe/Berlin'
    FROM timers;
  `);
  await before.close();

  const seenBeforeMigrating: number[] = [];
  const database = openDatabase(path);
  const after = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    database,
    sources,
    async beforeMigrations() {
      // Where the desktop takes its Backup: the old entry is still there.
      seenBeforeMigrating.push(await storedEntries(database));
    },
  });
  try {
    const client: Client = createORPCClient(new RPCLink({ port: after.openPort() }));
    expect(seenBeforeMigrating).toEqual([1]);
    await expect(client.health()).resolves.toMatchObject({ state: "ready" });
    await expect(
      client.timeTracking.days({ span: { first: "2026-11-09", last: "2026-11-22" } }),
    ).resolves.toMatchObject({ total: 0 });
    await expect(client.timeTracking.runningTimers()).resolves.toMatchObject([
      { id: timer.id, note: "Design" },
    ]);
    // The Timer stops into an entry of the new shape.
    await client.timeTracking.editTimer({ id: timer.id, startedAt: "2026-11-16T08:00:10.000Z" });
    await expect(client.timeTracking.stopTimer({ id: timer.id })).resolves.toMatchObject({
      kind: "saved",
      entry: {
        id: timer.id,
        roundedTime: { start: "2026-11-16T08:00:00.000Z", end: "2026-11-16T09:00:00.000Z" },
        bookedDuration: 3600,
      },
    });
  } finally {
    await after.close();
  }
});
