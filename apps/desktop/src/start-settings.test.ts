// The app's Data Process writes the device's zone as the Time Zone at its first start (D353), and
// never over a stored one. Through the app's modules and the Port, as a page loads its Settings.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { AppContract } from "@self-engine/contracts";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { resolveTimeZone, type TimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { afterEach, expect, test } from "vite-plus/test";
import { dataModules as modules } from "./data-modules.ts";
import { startSettings } from "./start-settings.ts";

const started: TestDataProcess[] = [];
const folders: string[] = [];

afterEach(async () => {
  for (const dataProcess of started.splice(0)) await dataProcess.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const BERLIN = resolveTimeZone("Europe/Berlin").timeZone;
const NEW_YORK = resolveTimeZone("America/New_York").timeZone;

function databaseFile(): string {
  const folder = mkdtempSync(join(tmpdir(), "self-engine-start-zone-"));
  folders.push(folder);
  return join(folder, "data.sqlite");
}

/** Starts the app's modules on `file` as the app's composition does, on a device in `zone`. */
async function startApp(file: string, zone: TimeZone) {
  const deviceZone = () => zone;
  const dataProcess = await startTestDataProcess({
    modules,
    database: openDatabase(file),
    deviceZone: zone,
    startSettings: startSettings({ deviceZone }),
  });
  started.push(dataProcess);
  const client = createORPCClient<ContractRouterClient<AppContract>>(
    new RPCLink({ port: dataProcess.openPort() }),
  );
  return { dataProcess, client };
}

test("the first start stores the device's zone as the Time Zone before it answers a call", async () => {
  const { client } = await startApp(databaseFile(), NEW_YORK);

  await expect(client.settings.load({})).resolves.toEqual([
    { key: TIME_ZONE_SETTING.key, value: "America/New_York" },
  ]);
});

test("a start over a stored Time Zone leaves it alone", async () => {
  const file = databaseFile();
  const first = await startApp(file, BERLIN);
  await first.client.settings.save({
    entries: [{ key: TIME_ZONE_SETTING.key, value: "Asia/Tokyo" }],
  });
  await first.dataProcess.close();
  started.splice(started.indexOf(first.dataProcess), 1);

  const { client } = await startApp(file, NEW_YORK);

  await expect(client.settings.load({})).resolves.toEqual([
    { key: TIME_ZONE_SETTING.key, value: "Asia/Tokyo" },
  ]);
});
