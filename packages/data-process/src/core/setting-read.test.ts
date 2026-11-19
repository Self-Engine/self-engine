// Every start migrates the Settings table, and a module reads a Setting through the context of
// its call (D352). Through the test helper and its Port, as an app starts the core and calls it.

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { checkConventions } from "@self-engine/db/testing";
import type { SettingsTables } from "@self-engine/settings-rows";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import { workday, workdayHours } from "@self-engine/storage/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

type Client = ContractRouterClient<ProtocolContract & { workday: typeof workday.contract }>;

const started: TestDataProcess[] = [];

afterEach(async () => {
  for (const dataProcess of started.splice(0)) await dataProcess.close();
});

async function start() {
  const dataProcess = await startTestDataProcess({ modules: { workday } });
  started.push(dataProcess);
  const client: Client = createORPCClient(new RPCLink({ port: dataProcess.openPort() }));
  return { dataProcess, client };
}

/** The Personal Space the start made sure of: every Setting of the user belongs to it. */
function personalSpace(dataProcess: TestDataProcess) {
  const sources = dataProcess.contextSources;
  if (sources === undefined) throw new Error("The test Data Process did not start ready");
  return sources.spaceId;
}

function settingRows(dataProcess: TestDataProcess) {
  return dataProcess.database.kysely
    .withTables<SettingsTables>()
    .selectFrom("settings")
    .selectAll()
    .execute();
}

test("a Data Process without modules holds the Settings table, and it follows the conventions", async () => {
  const dataProcess = await startTestDataProcess();
  started.push(dataProcess);
  await expect(settingRows(dataProcess)).resolves.toEqual([]);
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
  const before = await settingRows(dataProcess);

  await expect(client.workday.hours()).resolves.toBe(8);

  expect(await settingRows(dataProcess)).toEqual(before);
});
