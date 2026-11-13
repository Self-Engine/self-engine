import type { Clock } from "@self-engine/time";
import { EventEmitter } from "node:events";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import { type Backups, createBackups } from "@self-engine/backup";
import type { AppContract } from "@self-engine/contracts";
import { createDataConnection } from "@self-engine/data-client";
import type { ProtocolContract } from "@self-engine/data-protocol";
import type { Database, Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { createTestSources } from "@self-engine/db/testing";
import { sql } from "kysely";
import { afterEach, describe, expect, expectTypeOf, it } from "vite-plus/test";
import { dataModules } from "./data-modules.ts";
import { isRestartRequest, portHandoff, servingHealth } from "./data-process-messages.ts";
import {
  backupFolder,
  type DataProcessRuntime,
  openDataFiles,
  type ParentPort,
  runDataProcess,
} from "./data-process-runtime.ts";

/** Stands in for Electron's `process.parentPort`: the main process's side is `send`. */
class FakeParentPort extends EventEmitter implements ParentPort {
  readonly sent: unknown[] = [];
  onPost: (message: unknown) => void = () => {};

  postMessage(message: unknown): void {
    this.sent.push(message);
    this.onPost(message);
  }

  send(data: unknown, ports: MessagePort[]): void {
    this.emit("message", { data, ports });
  }
}

/** Backups for a test that is about something else: none is ever taken. */
const NO_BACKUPS: Backups = {
  list: () => Promise.resolve([]),
  create: () => Promise.reject(new Error("This test takes no Backup")),
  backUpBeforeMigrations: () => Promise.resolve(undefined),
  backUpIfDue: () => Promise.resolve(undefined),
  automaticBackupFailed: () => false,
  restore: () => Promise.resolve({ status: "notFound" }),
};

/** A timer no test fires: the hourly check of the daily Backup never runs on a real clock. */
function manualTimer() {
  const intervals: { callback: () => void; milliseconds: number }[] = [];
  return {
    intervals,
    setInterval(callback: () => void, milliseconds: number) {
      intervals.push({ callback, milliseconds });
      return intervals.length;
    },
  };
}

const fixtureModules = (migrations: readonly Migration[]) => ({
  fixture: { name: "fixture", migrations, contract: {}, rowMap: {}, entries: {} },
});

const opened: { database: Database; ports: MessagePort[] }[] = [];
const folders: string[] = [];

/** Runs the data process on `database`; `close` ends it like the exit of the real process. */
function run(
  parentPort: FakeParentPort,
  database: Database,
  options: Pick<DataProcessRuntime, "modules"> &
    Partial<Pick<DataProcessRuntime, "backups" | "timer" | "report">>,
) {
  const entry = { database, ports: [] as MessagePort[] };
  opened.push(entry);
  const channel = () => {
    const { port1, port2 } = new MessageChannel();
    entry.ports.push(port1, port2);
    return { port1, port2 };
  };
  return {
    channel,
    /** A connection of a page, handed over like the main process does. */
    connect(page = 1) {
      const { port1, port2 } = channel();
      parentPort.send(portHandoff(page), [port1]);
      const connection = createDataConnection<Omit<AppContract, keyof ProtocolContract>>();
      connection.connect(port2);
      return connection.client;
    },
    async close() {
      opened.splice(opened.indexOf(entry), 1);
      for (const port of entry.ports) port.close();
      await database.close();
    },
    running: runDataProcess({
      parentPort,
      database,
      checkOutputs: true,
      sources: createTestSources("2026-01-01T00:00:00.000Z"),
      backups: NO_BACKUPS,
      timer: manualTimer(),
      ...options,
    }),
  };
}

function start(parentPort: FakeParentPort, migrations?: readonly Migration[]) {
  return run(parentPort, openDatabase(":memory:"), {
    modules: migrations === undefined ? dataModules : fixtureModules(migrations),
  });
}

afterEach(async () => {
  for (const { database, ports } of opened.splice(0)) {
    for (const port of ports) port.close();
    await database.close();
  }
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true });
});

describe("runDataProcess", () => {
  it("starts from the app's module list, applies its migrations and answers health", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;
    expect(parentPort.sent.map((message) => servingHealth(message)?.state)).toEqual(["ready"]);

    const { port1, port2 } = channel();
    parentPort.send(portHandoff(1), [port1]);
    const connection = createDataConnection();
    connection.connect(port2);

    await expect(connection.client.health()).resolves.toMatchObject({
      state: "ready",
      migrations: ["placeholder-alpha/0001"],
    });
  });

  it("serves a port handed over the moment it says it is serving", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    const connection = createDataConnection();
    parentPort.onPost = (message) => {
      if (servingHealth(message) === undefined) return;
      const { port1, port2 } = channel();
      parentPort.send(portHandoff(1), [port1]);
      connection.connect(port2);
    };
    await running;

    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("serves every port it is handed, one per window or reload", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;

    const answers = [channel(), channel()].map(({ port1, port2 }, index) => {
      parentPort.send(portHandoff(index + 1), [port1]);
      const connection = createDataConnection();
      connection.connect(port2);
      return connection.client.health();
    });

    await expect(Promise.all(answers)).resolves.toMatchObject([
      { state: "ready" },
      { state: "ready" },
    ]);
  });

  it("closes a page's earlier port when the page gets a new one, as after a reload", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;
    const before = channel();
    parentPort.send(portHandoff(1), [before.port1]);
    const reloaded = createDataConnection();
    reloaded.connect(before.port2);
    await reloaded.client.health();
    const closed = new Promise<void>((resolve) => before.port2.once("close", () => resolve()));

    const after = channel();
    parentPort.send(portHandoff(1), [after.port1]);
    const connection = createDataConnection();
    connection.connect(after.port2);

    await closed;
    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("keeps another page's port open", async () => {
    const parentPort = new FakeParentPort();
    const { channel, running } = start(parentPort);
    await running;
    const first = channel();
    parentPort.send(portHandoff(1), [first.port1]);
    const second = channel();
    parentPort.send(portHandoff(2), [second.port1]);

    const connection = createDataConnection();
    connection.connect(first.port2);
    await expect(connection.client.health()).resolves.toMatchObject({ state: "ready" });
  });

  it("says it is serving in a failure state too, so the main process does not restart it", async () => {
    const parentPort = new FakeParentPort();
    const { running } = start(parentPort, [{ name: "fixture/0001", sql: "NOT SQL;" }]);
    await running;

    expect(parentPort.sent.map(servingHealth)).toEqual([
      { state: "migrationFailed", migration: "fixture/0001" },
    ]);
  });

  it("ignores a message that hands over no port", async () => {
    const parentPort = new FakeParentPort();
    const { running } = start(parentPort);
    await running;

    expect(() => parentPort.send("something else", [])).not.toThrow();
  });
});

/** The data process on real files in a temporary data folder, with a clock the test moves. */
function dataFolder() {
  const folder = mkdtempSync(join(tmpdir(), "self-engine-data-process-"));
  folders.push(folder);
  const databasePath = join(folder, "self-engine.sqlite");
  // A Friday, at noon UTC.
  const sources = createTestSources("2026-11-13T12:00:00.000Z");
  return {
    databasePath,
    sources,
    /**
     * One start of the data process, as `data-process.ts` does it. With `disk`, every Backup is
     * written to a disk the test fills and empties: while it is full, the copy fails.
     */
    start(modules: DataProcessRuntime["modules"] = dataModules, disk?: { full: boolean }) {
      const parentPort = new FakeParentPort();
      const files = openDataFiles(databasePath, sources.clock);
      const timer = manualTimer();
      const reports: unknown[] = [];
      const backups =
        disk === undefined
          ? files.backups
          : createBackups({
              database: {
                ...files.database,
                backupTo: (destination) =>
                  disk.full
                    ? Promise.reject(new Error("database or disk is full"))
                    : files.database.backupTo(destination),
              },
              databasePath,
              directory: backupFolder(databasePath),
              clock: sources.clock,
            });
      return {
        parentPort,
        timer,
        reports,
        database: files.database,
        backups,
        ...run(parentPort, files.database, {
          modules,
          backups,
          timer,
          report: (report) => reports.push(report),
        }),
      };
    },
  };
}

const NOTES: Migration = {
  name: "fixture/0001",
  sql: "CREATE TABLE fixture_notes (body TEXT PRIMARY KEY) STRICT;",
};
/** A migration that works on the rows it finds: every note gets its length. */
const LENGTHS: Migration = {
  name: "fixture/0002",
  sql: `
    ALTER TABLE fixture_notes ADD COLUMN length INTEGER;
    UPDATE fixture_notes SET length = length(body);
  `,
};
const TAGS: Migration = {
  name: "fixture/0002",
  sql: "CREATE TABLE fixture_tags (name TEXT PRIMARY KEY) STRICT;",
};

async function tableNames(database: Database): Promise<string[]> {
  const { rows } = await sql<{ name: string }>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'fixture_%' ORDER BY name
  `.execute(database.kysely);
  return rows.map(({ name }) => name);
}

describe("the Backups of the data process", () => {
  it("keeps them in `backups` beside the database", () => {
    expect(backupFolder(join("/data", "Self-Engine", "self-engine.sqlite"))).toBe(
      join("/data", "Self-Engine", "backups"),
    );
  });

  it("takes a Backup before pending migrations run, which opens and holds the data from before", async () => {
    const folder = dataFolder();
    const first = folder.start(fixtureModules([NOTES]));
    await first.running;
    await first.database.executeScript("INSERT INTO fixture_notes VALUES ('written by 0001');");
    await first.backups.list();
    await first.close();
    folder.sources.advance(60_000);

    const second = folder.start(fixtureModules([NOTES, TAGS]));
    await second.running;

    expect(second.parentPort.sent.map(servingHealth)).toMatchObject([
      { state: "ready", migrations: ["fixture/0002"] },
    ]);
    const backup = (await second.backups.list()).find(({ kind }) => kind === "before-migration");
    expect(backup).toMatchObject({ takenAt: "2026-11-13T12:01:00.000Z" });
    const copy = openDatabase(join(backupFolder(folder.databasePath), `${backup?.id}.sqlite`));
    try {
      await expect(tableNames(copy)).resolves.toEqual(["fixture_notes"]);
      const { rows } = await sql`SELECT body FROM fixture_notes`.execute(copy.kysely);
      expect(rows).toEqual([{ body: "written by 0001" }]);
    } finally {
      await copy.close();
    }
    await expect(tableNames(second.database)).resolves.toEqual(["fixture_notes", "fixture_tags"]);
  });

  it("takes no Backup before the migrations of a first start: there is nothing to protect yet", async () => {
    const folder = dataFolder();

    const first = folder.start(fixtureModules([NOTES]));
    await first.running;

    expect((await first.backups.list()).map(({ kind }) => kind)).toEqual(["daily"]);
  });

  it("takes no Backup at a start without pending migrations", async () => {
    const folder = dataFolder();
    const first = folder.start(fixtureModules([NOTES]));
    await first.running;
    await first.backups.list();
    await first.close();
    folder.sources.advance(60_000);

    const second = folder.start(fixtureModules([NOTES]));
    await second.running;

    // The daily one of the first start is the day's Backup; the second start adds none.
    expect((await second.backups.list()).map(({ kind }) => kind)).toEqual(["daily"]);
  });

  it("takes the daily Backup once it serves, and asks again every hour", async () => {
    const folder = dataFolder();
    const started = folder.start();
    await started.running;

    expect(await started.backups.list()).toMatchObject([
      { kind: "daily", takenAt: "2026-11-13T12:00:00.000Z" },
    ]);
    expect(started.timer.intervals.map(({ milliseconds }) => milliseconds)).toEqual([3_600_000]);

    folder.sources.advance(12 * 3_600_000);
    started.timer.intervals[0]?.callback();
    expect((await started.backups.list()).map(({ takenAt }) => takenAt)).toEqual([
      "2026-11-14T00:00:00.000Z",
      "2026-11-13T12:00:00.000Z",
    ]);
  });

  it("takes no Backup of a database whose migration failed", async () => {
    const folder = dataFolder();

    const started = folder.start(fixtureModules([{ name: "fixture/0001", sql: "NOT SQL;" }]));
    await started.running;

    expect(started.parentPort.sent.map((message) => servingHealth(message)?.state)).toEqual([
      "migrationFailed",
    ]);
    await expect(started.backups.list()).resolves.toEqual([]);
    expect(started.timer.intervals).toEqual([]);
  });

  it("restores a Backup: the page asks, the process asks for its restart, and the next start serves the data of the Backup", async () => {
    const folder = dataFolder();
    const first = folder.start();
    await first.running;
    const page = first.connect();
    await page.placeholderAlpha.create({ name: "Before the Backup" });
    folder.sources.advance(60_000);
    const backup = await page.backups.create({});
    await page.placeholderAlpha.create({ name: "After the Backup" });
    folder.sources.advance(60_000);
    const asked = new Promise<void>((resolve) => {
      first.parentPort.onPost = (message) => {
        if (isRestartRequest(message)) resolve();
      };
    });

    const replaced = await page.backups.restore({ id: backup.id });
    await asked;
    // The main process ends the data process and starts the next one on the same file.
    await first.close();
    const second = folder.start();
    await second.running;
    const pageAgain = second.connect();

    expect((await pageAgain.placeholderAlpha.list({})).map(({ name }) => name)).toEqual([
      "Before the Backup",
    ]);
    expect(replaced).toMatchObject({ kind: "before-restore", takenAt: "2026-11-13T12:02:00.000Z" });
    expect((await pageAgain.backups.list({})).backups.map(({ kind }) => kind)).toEqual([
      "before-restore",
      "manual",
      "daily",
    ]);
    // What the restore replaced is in its own Backup, so it can be taken back.
    folder.sources.advance(60_000);
    await pageAgain.backups.restore({ id: replaced.id });
    await second.close();
    const third = folder.start();
    await third.running;
    expect((await third.connect().placeholderAlpha.list({})).map(({ name }) => name)).toEqual([
      "Before the Backup",
      "After the Backup",
    ]);
    expect(readdirSync(dirname(folder.databasePath))).not.toContain("self-engine.sqlite.restore");
  });

  it("restores a Backup from before the newest migration: the next start migrates the restored data", async () => {
    const folder = dataFolder();
    const before = folder.start(fixtureModules([NOTES]));
    await before.running;
    await before.database.executeScript(
      "INSERT INTO fixture_notes VALUES ('written before the update');",
    );
    folder.sources.advance(60_000);
    const backup = await before.connect().backups.create({});
    await before.close();
    folder.sources.advance(60_000);
    // The app is updated: this start runs the new migration.
    const updated = folder.start(fixtureModules([NOTES, LENGTHS]));
    await updated.running;
    await updated.database.executeScript(
      "INSERT INTO fixture_notes VALUES ('written after the update', 24);",
    );
    folder.sources.advance(60_000);
    const asked = new Promise<void>((resolve) => {
      updated.parentPort.onPost = (message) => {
        if (isRestartRequest(message)) resolve();
      };
    });

    await updated.connect().backups.restore({ id: backup.id });
    await asked;
    await updated.close();
    folder.sources.advance(60_000);
    const restored = folder.start(fixtureModules([NOTES, LENGTHS]));
    await restored.running;

    // The Backup held the schema of the older app, so the migration was pending again and ran
    // on the restored rows.
    expect(restored.parentPort.sent.map(servingHealth)).toMatchObject([
      { state: "ready", migrations: ["fixture/0002"] },
    ]);
    const { rows } = await sql`SELECT body, length FROM fixture_notes`.execute(
      restored.database.kysely,
    );
    expect(rows).toEqual([{ body: "written before the update", length: 25 }]);
    // Like every start with pending migrations, it took its Backup first.
    expect(await restored.backups.list()).toContainEqual(
      expect.objectContaining({ kind: "before-migration", takenAt: "2026-11-13T12:04:00.000Z" }),
    );
  });

  it("tells the page while the daily Backup fails, reports it, and stops once one succeeds", async () => {
    const folder = dataFolder();
    const disk = { full: true };
    const started = folder.start(dataModules, disk);
    await started.running;
    const page = started.connect();

    // The failure does not stop the data process: it serves, and the page can ask.
    await expect(page.backups.list({})).resolves.toEqual({
      backups: [],
      automaticBackupFailed: true,
    });
    expect(started.reports).toEqual([
      {
        kind: "unexpected-error",
        entry: "backups.daily",
        error: expect.objectContaining({ message: "database or disk is full" }),
      },
    ]);

    disk.full = false;
    // The next hour asks again.
    started.timer.intervals[0]?.callback();

    await expect(page.backups.list({})).resolves.toMatchObject({
      backups: [{ kind: "daily" }],
      automaticBackupFailed: false,
    });
  });

  it("stops the start when the Backup before migrations fails, and runs no migration", async () => {
    const folder = dataFolder();
    const first = folder.start(fixtureModules([NOTES]));
    await first.running;
    await first.backups.list();
    await first.close();
    folder.sources.advance(60_000);

    const second = folder.start(fixtureModules([NOTES, TAGS]), { full: true });

    await expect(second.running).rejects.toThrow("database or disk is full");
    // It never says that it serves: `data-process.ts` logs the failure and exits.
    expect(second.parentPort.sent).toEqual([]);
    await expect(tableNames(second.database)).resolves.toEqual(["fixture_notes"]);
  });

  it("answers a restore of a Backup that is gone with `not found` and asks for no restart", async () => {
    const folder = dataFolder();
    const started = folder.start();
    await started.running;
    const page = started.connect();

    await expect(
      page.backups.restore({ id: "2026-01-01T12-00-00-000Z-daily" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await new Promise<void>((resolve) => setTimeout(() => setImmediate(resolve)));

    expect(started.parentPort.sent.filter(isRestartRequest)).toEqual([]);
  });
});

it("opening data files requires the Instant clock and startup requires sources", () => {
  expectTypeOf(openDataFiles).parameters.toEqualTypeOf<[string, Clock]>();
  expectTypeOf<DataProcessRuntime>().toExtend<{
    sources: { clock: Clock };
  }>();
});
