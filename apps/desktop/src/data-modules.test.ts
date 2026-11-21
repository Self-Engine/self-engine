import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { type AppContract, appContract } from "@self-engine/contracts";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { PROTOCOL_PROCEDURES, type ProtocolContract } from "@self-engine/data-protocol";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { dataModules as modules } from "./data-modules.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

test("registered app module namespaces match the mounted app contract", () => {
  type Namespaces = Exclude<keyof AppContract, keyof ProtocolContract>;
  expectTypeOf<keyof typeof modules>().toEqualTypeOf<Namespaces>();
  expect(Object.keys(modules).sort()).toEqual(
    Object.keys(appContract)
      .filter((key) => !(PROTOCOL_PROCEDURES as readonly string[]).includes(key))
      .sort(),
  );
});

test("the app mounts Projects, Settings and Time Tracking beside the protocol, without placeholders (D315)", async () => {
  const process = await startTestDataProcess({ modules });
  started.push(process);
  const client = createORPCClient<ContractRouterClient<AppContract>>(
    new RPCLink({ port: process.openPort() }),
  );
  await expect(client.health()).resolves.toMatchObject({
    state: "ready",
    migrations: [
      "projects/0001",
      "settings/0001",
      "spaces/0001",
      "time-tracking/0001",
      "time-tracking/0002",
    ],
  });
  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toEqual({
    done: false,
    value: {
      kind: "opened",
      queries: {
        projects: { active: ["projects"], archived: ["projects"] },
        settings: { load: ["settings"] },
        timeTracking: {
          entry: ["time_entries", "projects"],
          days: ["time_entries", "projects", "settings"],
          runningTimers: ["timers", "projects"],
        },
        backups: { list: [] },
      },
    },
  });
  await events.return();
});

test("projects is mounted: a created project follows its Table Change into the active Query", async () => {
  const process = await startTestDataProcess({ modules });
  started.push(process);
  const client = createORPCClient<ContractRouterClient<AppContract>>(
    new RPCLink({ port: process.openPort() }),
  );
  const events = await client.tablesChanged();
  await events.next();

  const created = await client.projects.create({ title: "Website" });

  await expect(events.next()).resolves.toEqual({
    done: false,
    value: { kind: "changed", tables: ["projects"] },
  });
  await expect(client.projects.active({})).resolves.toEqual([
    {
      id: created.id,
      title: "Website",
      description: null,
      icon: null,
      color: null,
      archivedAt: null,
    },
  ]);
  await events.return();
});

test("a Settings save announces the Settings table and the mounted Query sees the committed batch", async () => {
  const process = await startTestDataProcess({ modules });
  started.push(process);
  const client = createORPCClient<ContractRouterClient<AppContract>>(
    new RPCLink({ port: process.openPort() }),
  );
  const events = await client.tablesChanged();
  await events.next();

  const entries = [
    { key: "appearance.accent", value: "blue" },
    { key: "i18n.language", value: "de" },
  ];
  await client.settings.save({ entries });

  await expect(events.next()).resolves.toEqual({
    done: false,
    value: { kind: "changed", tables: ["settings"] },
  });
  expect(await client.settings.load({})).toEqual(expect.arrayContaining(entries));
  await events.return();
});
