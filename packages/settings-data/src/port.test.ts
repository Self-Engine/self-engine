import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import {
  startTestDataProcess,
  type TestDataProcess,
  type TestDataProcessOptions,
} from "@self-engine/data-process/testing";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { defineReason } from "@self-engine/db/schema";
import type { SettingEntry } from "@self-engine/settings";
import { settingsRowMap } from "@self-engine/settings-rows";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import { protectionRule } from "@self-engine/storage";
import { z } from "zod";
import { afterEach, expect, test } from "vite-plus/test";
import type { settingsContract } from "./contracts/index.ts";
import { settings } from "./data/index.ts";

type Client = ContractRouterClient<ProtocolContract & { settings: typeof settingsContract }>;

const started: TestDataProcess[] = [];
const folders: string[] = [];

afterEach(async () => {
  for (const dataProcess of started.splice(0)) await dataProcess.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

async function start(
  options: Omit<TestDataProcessOptions<{ settings: typeof settings }>, "modules"> = {},
) {
  const dataProcess = await startTestDataProcess({ ...options, modules: { settings } });
  started.push(dataProcess);
  const client: Client = createORPCClient(new RPCLink({ port: dataProcess.openPort() }));
  return { client, dataProcess };
}

test("a save replaces and inserts entries together and leaves unsent entries alone", async () => {
  const { client } = await start();
  await client.settings.save({
    entries: [
      { key: "appearance.accent", value: "blue" },
      { key: "i18n.language", value: "de" },
    ],
  });

  await client.settings.save({
    entries: [
      { key: "appearance.accent", value: "red" },
      { key: "appearance.backgroundTint", value: true },
    ],
  });

  const loaded = await client.settings.load({});
  expect(loaded).toHaveLength(3);
  expect(loaded).toEqual(
    expect.arrayContaining([
      { key: "appearance.accent", value: "red" },
      { key: "appearance.backgroundTint", value: true },
      { key: "i18n.language", value: "de" },
    ]),
  );
});

test("Synced appearance and App Language survive a Data Process restart", async () => {
  const folder = mkdtempSync(join(tmpdir(), "self-engine-settings-port-"));
  folders.push(folder);
  const path = join(folder, "data.sqlite");
  const entries: readonly SettingEntry[] = [
    { key: "appearance.lightTheme", value: "warm" },
    { key: "appearance.darkTheme", value: "cool" },
    { key: "appearance.accent", value: "green" },
    { key: "appearance.backgroundTint", value: true },
    { key: "i18n.language", value: "de" },
  ];
  const first = await start({ database: openDatabase(path) });
  await first.client.settings.save({ entries });
  await first.dataProcess.close();
  started.pop();

  const restarted = await start({ database: openDatabase(path) });
  const loaded = await restarted.client.settings.load({});

  expect(loaded).toHaveLength(entries.length);
  expect(loaded).toEqual(expect.arrayContaining<unknown>([...entries]));
});

test("unknown keys round-trip with their JSON values, including null", async () => {
  const { client } = await start();
  const entries: readonly SettingEntry[] = [
    { key: "future.layout", value: { columns: [1, "wide", false] } },
    { key: "future.selection", value: null },
  ];

  await client.settings.save({ entries });

  const loaded = await client.settings.load({});
  expect(loaded).toHaveLength(2);
  expect(loaded).toEqual(expect.arrayContaining<unknown>([...entries]));
});

test("loading skips malformed JSON and still answers with the other entries", async () => {
  const { client, dataProcess } = await start();
  const spaceId = dataProcess.contextSources?.spaceId;
  if (spaceId === undefined) throw new Error("The test Data Process did not start ready");
  await createSettingRows(dataProcess.database.kysely, [
    { spaceId, key: "future.broken", text: "{broken" },
    { spaceId, key: "future.selection", value: null },
  ]);

  await expect(client.settings.load({})).resolves.toEqual([
    { key: "future.selection", value: null },
  ]);
});

test("a refused entry rolls back earlier writes in the same save", async () => {
  const reserved = defineReason("reserved", z.strictObject({}));
  const refuseReserved = protectionRule(settingsRowMap, {
    table: "settings",
    write: "insert",
    reasons: [reserved],
    async answer(_tx, _context, rows) {
      return rows
        .filter(({ values }) => values.key === "fixture.reserved")
        .map(({ id }) => ({ row: id, code: reserved.code, details: {} }));
    },
  });
  const { client } = await start({ rules: [refuseReserved] });
  await client.settings.save({ entries: [{ key: "fixture.existing", value: "old" }] });

  await expect(
    client.settings.save({
      entries: [
        { key: "fixture.existing", value: "new" },
        { key: "fixture.inserted", value: true },
        { key: "fixture.reserved", value: true },
      ],
    }),
  ).rejects.toMatchObject({ code: "REFUSED" });

  await expect(client.settings.load({})).resolves.toEqual([
    { key: "fixture.existing", value: "old" },
  ]);
});

test("the last value wins when a batch repeats a key", async () => {
  const { client } = await start();

  await client.settings.save({
    entries: [
      { key: "fixture.selection", value: "first" },
      { key: "fixture.selection", value: "last" },
    ],
  });

  await expect(client.settings.load({})).resolves.toEqual([
    { key: "fixture.selection", value: "last" },
  ]);
});
