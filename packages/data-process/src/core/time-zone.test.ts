// A module gets the Time Zone of its call through the context (D352, D353): the stored Setting,
// resolved by `time`, with the device's zone of the Data Process standing in for a name this
// runtime does not know. Through the Port of the test Data Process, as an app calls the core.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import type { Database } from "@self-engine/db";
import { SETTINGS_TABLE, type SettingsTables } from "@self-engine/settings-rows";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import { workday } from "@self-engine/storage/testing";
import { resolveTimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { afterEach, expect, test } from "vite-plus/test";
import {
  startTestDataProcess,
  type TestDataProcess,
  type TestDataProcessOptions,
} from "../testing/index.ts";

type Client = ContractRouterClient<ProtocolContract & { workday: typeof workday.contract }>;

const started = new Set<TestDataProcess>();

afterEach(async () => {
  for (const dataProcess of started) await dataProcess.close();
  started.clear();
});

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
const NEW_YORK = resolveTimeZone("America/New_York").timeZone;

async function start(options: TestDataProcessOptions<{ workday: typeof workday }> = {}) {
  const dataProcess = await startTestDataProcess({ ...options, modules: { workday } });
  started.add(dataProcess);
  const client: Client = createORPCClient(new RPCLink({ port: dataProcess.openPort() }));
  const spaceId = dataProcess.contextSources?.spaceId;
  if (spaceId === undefined) throw new Error("The test Data Process did not start ready");
  return { dataProcess, client, spaceId };
}

/** Stores a zone name as the settings area saves it: the Setting's row holds the JSON text. */
async function saveZone(database: Database, name: string) {
  await database.kysely
    .withTables<SettingsTables>()
    .updateTable(SETTINGS_TABLE)
    .set({ value: JSON.stringify(name) })
    .where("key", "=", TIME_ZONE_SETTING.key)
    .execute();
}

test("a test Data Process started with a zone west of UTC gives that zone to a call", async () => {
  const { client } = await start({ deviceZone: NEW_YORK });

  await expect(client.workday.zone()).resolves.toBe("America/New_York");
});

test("a call answers with the stored Time Zone, and after a save the next call with the new one", async () => {
  const { dataProcess, client, spaceId } = await start({ deviceZone: BERLIN });
  await createSettingRows(dataProcess.database.kysely, [
    { key: TIME_ZONE_SETTING.key, value: "Asia/Tokyo", spaceId },
  ]);
  await expect(client.workday.zone()).resolves.toBe("Asia/Tokyo");

  await saveZone(dataProcess.database, "America/Los_Angeles");

  await expect(client.workday.zone()).resolves.toBe("America/Los_Angeles");
});

test("an unknown stored name computes with the device's zone, keeps the row and is reported once", async () => {
  const reports: unknown[] = [];
  const { dataProcess, client, spaceId } = await start({
    deviceZone: NEW_YORK,
    report: (report) => reports.push(report),
  });
  const rows = await createSettingRows(dataProcess.database.kysely, [
    { key: TIME_ZONE_SETTING.key, value: "Mars/Olympus_Mons", spaceId },
  ]);

  await expect(client.workday.zone()).resolves.toBe("America/New_York");
  await expect(client.workday.zone()).resolves.toBe("America/New_York");

  expect(reports).toEqual([{ kind: "unknown-time-zone", name: "Mars/Olympus_Mons" }]);
  await expect(
    dataProcess.database.kysely
      .withTables<SettingsTables>()
      .selectFrom(SETTINGS_TABLE)
      .selectAll()
      .execute(),
  ).resolves.toEqual(rows);
});

test("each unknown name is reported once, a stored zone that is not set never", async () => {
  const reports: unknown[] = [];
  const { dataProcess, client, spaceId } = await start({
    report: (report) => reports.push(report),
  });
  await createSettingRows(dataProcess.database.kysely, [
    { key: TIME_ZONE_SETTING.key, value: null, spaceId },
  ]);
  await expect(client.workday.zone()).resolves.toBe("Europe/Berlin");
  await saveZone(dataProcess.database, "Mars/Olympus_Mons");
  await client.workday.zone();
  await saveZone(dataProcess.database, "Venus/Maxwell");
  await client.workday.zone();
  await saveZone(dataProcess.database, "Mars/Olympus_Mons");
  await client.workday.zone();

  expect(reports).toEqual([
    { kind: "unknown-time-zone", name: "Mars/Olympus_Mons" },
    { kind: "unknown-time-zone", name: "Venus/Maxwell" },
  ]);
});

test("the Query that asks for the Time Zone names the Settings table, so a save reloads it", async () => {
  const { client } = await start();
  const events = await client.tablesChanged();

  const opened = await events.next();

  expect(opened.value).toMatchObject({
    kind: "opened",
    queries: { workday: { zone: [SETTINGS_TABLE] } },
  });
  await events.return();
});
