// Every start migrates the Settings table, and a module reads a Setting through the context of
// its call (D352). Through the test helper and its Port, as an app starts the core and calls it.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { createMigrationRunner, type Database } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { checkConventions, createTestSources } from "@self-engine/db/testing";
import { settingsMigrations, type SettingsTables } from "@self-engine/settings-rows";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import { spacesMigrations, type SpacesTables } from "@self-engine/spaces";
import { workday, workdayHours } from "@self-engine/storage/testing";
import { TableNode, type KyselyPlugin } from "kysely";
import { afterEach, expect, test } from "vite-plus/test";
import { startSetting } from "./index.ts";
import {
  startTestDataProcess,
  type TestDataProcess,
  type TestDataProcessOptions,
} from "../testing/index.ts";

type Client = ContractRouterClient<ProtocolContract & { workday: typeof workday.contract }>;

const started = new Set<TestDataProcess>();
const folders: string[] = [];

afterEach(async () => {
  for (const dataProcess of started) await close(dataProcess);
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function databaseFile(): string {
  const folder = mkdtempSync(join(tmpdir(), "self-engine-start-settings-"));
  folders.push(folder);
  return join(folder, "data.sqlite");
}

async function close(dataProcess: TestDataProcess) {
  started.delete(dataProcess);
  await dataProcess.close();
}

async function start(options: TestDataProcessOptions<{ workday: typeof workday }> = {}) {
  const dataProcess = await startTestDataProcess({ ...options, modules: { workday } }).catch(
    async (error) => {
      await options.database?.close();
      throw error;
    },
  );
  started.add(dataProcess);
  const client: Client = createORPCClient(new RPCLink({ port: dataProcess.openPort() }));
  return { dataProcess, client };
}

/** The Personal Space the start made sure of: every Setting of the user belongs to it. */
function personalSpace(dataProcess: TestDataProcess) {
  const sources = dataProcess.contextSources;
  if (sources === undefined) throw new Error("The test Data Process did not start ready");
  return sources.spaceId;
}

function settingRows(database: Database) {
  return database.kysely.withTables<SettingsTables>().selectFrom("settings").selectAll().execute();
}

test("a Data Process without modules holds the Settings table, and it follows the conventions", async () => {
  const dataProcess = await startTestDataProcess();
  started.add(dataProcess);
  await expect(settingRows(dataProcess.database)).resolves.toEqual([]);
  await expect(checkConventions(dataProcess.database)).resolves.toEqual([]);
});

test("a Query answers with the stored Setting of the Personal Space", async () => {
  const { dataProcess, client } = await start();
  await createSettingRows(dataProcess.database.kysely, [
    { key: workdayHours.key, value: 6, spaceId: personalSpace(dataProcess) },
  ]);

  const hours: number = await client.workday.hours();

  expect(hours).toBe(6);
});

test("the first call reads a listed Setting written in the Personal Space", async () => {
  const { dataProcess, client } = await start({ startSettings: [startSetting(workdayHours, 6)] });

  await expect(client.workday.hours()).resolves.toBe(6);
  await expect(settingRows(dataProcess.database)).resolves.toMatchObject([
    { space_id: personalSpace(dataProcess), key: workdayHours.key, value: "6" },
  ]);
});

test.each([
  { stored: "6", answer: 6 },
  { stored: "30", answer: 8 },
  { stored: "{broken", answer: 8 },
])(
  "a restart leaves an existing Setting with stored text $stored untouched",
  async ({ stored, answer }) => {
    const file = databaseFile();
    const first = await start({ database: openDatabase(file) });
    const [row] = await createSettingRows(first.dataProcess.database.kysely, [
      { key: workdayHours.key, text: stored, spaceId: personalSpace(first.dataProcess) },
    ]);
    await close(first.dataProcess);

    const { client, dataProcess } = await start({
      database: openDatabase(file),
      startSettings: [startSetting(workdayHours, 7)],
    });

    await expect(client.workday.hours()).resolves.toBe(answer);
    expect(await settingRows(dataProcess.database)).toEqual([row]);
  },
);

test("a Setting written on the first start survives a second start with another value", async () => {
  const file = databaseFile();
  const first = await start({
    database: openDatabase(file),
    startSettings: [startSetting(workdayHours, 6)],
  });
  const before = await settingRows(first.dataProcess.database);
  await close(first.dataProcess);

  const { dataProcess, client } = await start({
    database: openDatabase(file),
    startSettings: [startSetting(workdayHours, 7)],
  });

  await expect(client.workday.hours()).resolves.toBe(6);
  expect(await settingRows(dataProcess.database)).toEqual(before);
});

test("concurrent starts keep the Setting from the first writer", async () => {
  const file = databaseFile();
  await start({ database: openDatabase(file) });
  const second = openDatabase(file);
  const read = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const settingReads = new WeakSet<object>();
  const pauseAfterRead: KyselyPlugin = {
    transformQuery({ node, queryId }) {
      if (
        node.kind === "SelectQueryNode" &&
        node.from?.froms.some(
          (table) => TableNode.is(table) && table.table.identifier.name === "settings",
        )
      ) {
        settingReads.add(queryId);
      }
      return node;
    },
    async transformResult({ result, queryId }) {
      if (settingReads.delete(queryId)) {
        read.resolve();
        await resume.promise;
      }
      return result;
    },
  };
  const late = start({
    database: { ...second, kysely: second.kysely.withPlugin(pauseAfterRead) },
    startSettings: [startSetting(workdayHours, 7)],
    sources: createTestSources("2026-01-03T00:00:00.000Z"),
  });

  try {
    await Promise.race([
      read.promise,
      late.then(() => {
        throw new Error("The second start completed before the Settings read");
      }),
    ]);
    const early = await start({
      database: openDatabase(file),
      startSettings: [startSetting(workdayHours, 6)],
      sources: createTestSources("2026-01-02T00:00:00.000Z"),
    });
    const before = await settingRows(early.dataProcess.database);
    resume.resolve();

    const { client, dataProcess } = await late;
    await expect(client.workday.hours()).resolves.toBe(6);
    expect(await settingRows(dataProcess.database)).toEqual(before);
  } finally {
    resume.resolve();
    await Promise.allSettled([late]);
  }
});

test("the startup list requires a value of the declaration's type and a Synced Setting", () => {
  const onDevice = { ...workdayHours, scope: "device" as const };
  // @ts-expect-error A string does not fit the hours declaration.
  void (() => startTestDataProcess({ startSettings: [startSetting(workdayHours, "6")] }));
  // @ts-expect-error A Device Setting stays on its device.
  void (() => startTestDataProcess({ startSettings: [startSetting(onDevice, 6)] }));
  // @ts-expect-error A raw object bypasses the typed pairing.
  void (() => startTestDataProcess({ startSettings: [{ setting: workdayHours, value: "6" }] }));
});

test("a failed batch leaves the Personal Space and a later start writes all missing Settings", async () => {
  const database = openDatabase(":memory:");
  let recovered: TestDataProcess | undefined;
  try {
    await createMigrationRunner(database, [...spacesMigrations, ...settingsMigrations]).run();
    await database.executeScript(`
      CREATE TRIGGER reject_overtime BEFORE INSERT ON settings
      WHEN NEW.key = 'workday.overtimeHours'
      BEGIN
        SELECT RAISE(FAIL, 'overtime insert blocked');
      END;
    `);
    const overtimeHours = { ...workdayHours, key: "workday.overtimeHours" };
    const startSettings = [startSetting(workdayHours, 6), startSetting(overtimeHours, 2)];
    const options = { database, startSettings };

    await expect(startTestDataProcess(options)).rejects.toThrow("overtime insert blocked");
    await expect(settingRows(database)).resolves.toEqual([]);
    const space = await database.kysely
      .withTables<SpacesTables>()
      .selectFrom("spaces")
      .select("id")
      .executeTakeFirst();
    expect(space).toBeDefined();

    await database.executeScript("DROP TRIGGER reject_overtime;");
    recovered = await startTestDataProcess(options);
    expect(personalSpace(recovered)).toBe(space?.id);
    const rows = await settingRows(database);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: workdayHours.key, value: "6", space_id: space?.id }),
        expect.objectContaining({ key: overtimeHours.key, value: "2", space_id: space?.id }),
      ]),
    );
  } finally {
    if (recovered === undefined) await database.close();
    else await recovered.close();
  }
});

test.each([
  { row: "is missing", rows: [] },
  { row: "fails the schema", rows: [{ key: workdayHours.key, value: 30 }] },
])("a Query answers with the default when the row $row, and writes nothing", async ({ rows }) => {
  const { dataProcess, client } = await start();
  const spaceId = personalSpace(dataProcess);
  await createSettingRows(
    dataProcess.database.kysely,
    rows.map((row) => ({ ...row, spaceId })),
  );
  const before = await settingRows(dataProcess.database);

  await expect(client.workday.hours()).resolves.toBe(8);

  expect(await settingRows(dataProcess.database)).toEqual(before);
});
