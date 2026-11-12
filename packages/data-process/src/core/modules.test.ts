import { appContract } from "@self-engine/contracts";
import { modules } from "./modules.ts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { oc, type ContractRouterClient } from "@orpc/contract";
import type { AppContract } from "@self-engine/contracts";
import { createTestSources } from "@self-engine/db/testing";
import { defineStorageModule, type FrameReport } from "@self-engine/storage";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

const fixture = defineStorageModule({
  name: "fixture",
  contract: {
    add: oc.input(z.string()).output(z.string()),
    list: oc.output(z.array(z.string())),
    audit: oc.input(z.string()).output(z.string()),
  },
  migrations: [
    {
      name: "fixture/0001",
      sql: "CREATE TABLE fixture_items (name TEXT NOT NULL) STRICT; CREATE TABLE fixture_audit (name TEXT NOT NULL) STRICT;",
    },
  ],
  rowMap: {
    fixture_items: z.object({ name: z.string() }),
    fixture_audit: z.object({ name: z.string() }),
  },
  entries: {
    audit: {
      kind: "operation",
      async run(tx, _context, name) {
        await tx.insertInto("fixture_audit").values({ name }).execute();
        return name;
      },
    },
    add: {
      kind: "operation",
      async run(tx, _context, name) {
        await tx.insertInto("fixture_items").values({ name }).execute();
        await tx.insertInto("fixture_audit").values({ name }).execute();
        return name;
      },
    },
    list: {
      kind: "query",
      reads: ["fixture_items"],
      async run(tx) {
        return (await tx.selectFrom("fixture_items").selectAll().execute()).map((row) => row.name);
      },
    },
  },
});
const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

async function start() {
  const process = await startTestDataProcess({
    modules: { fixture },
    sources: createTestSources(new Date("2026-01-01T00:00:00.000Z")),
  });
  started.push(process);
  return createORPCClient<ContractRouterClient<AppContract & { fixture: typeof fixture.contract }>>(
    new RPCLink({ port: process.openPort() }),
  );
}

test("a module list supplies migrations and calls over a MessageChannel", async () => {
  const client = await start();
  await expect(client.health()).resolves.toMatchObject({
    state: "ready",
    migrations: ["fixture/0001"],
  });
  await expect(client.fixture.add("Invoice")).resolves.toBe("Invoice");
  await expect(client.fixture.list()).resolves.toEqual(["Invoice"]);
});

test("each committed operation emits one event naming all its written tables", async () => {
  const client = await start();
  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toEqual({ done: false, value: [] });
  await client.fixture.add("First");
  await client.fixture.audit("Second");
  await expect(events.next()).resolves.toEqual({
    done: false,
    value: ["fixture_items", "fixture_audit"],
  });
  await expect(events.next()).resolves.toEqual({
    done: false,
    value: ["fixture_audit"],
  });
  await events.return();
});

test.each([true, false])(
  "start option checks outputs only when enabled (%s)",
  async (checkOutputs) => {
    const invalidOutput = defineStorageModule({
      name: "fixture",
      contract: { read: oc.output(z.string()) },
      rowMap: {},
      migrations: [],
      entries: { read: { kind: "query", reads: [], run: () => 42 as never } },
    });
    const process = await startTestDataProcess({
      modules: { fixture: invalidOutput },
      checkOutputs,
    });
    started.push(process);
    const client = createORPCClient<
      ContractRouterClient<{ fixture: typeof invalidOutput.contract }>
    >(new RPCLink({ port: process.openPort() }));
    if (checkOutputs)
      await expect(client.fixture.read()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    else await expect(client.fixture.read()).resolves.toBe(42);
  },
);

test("a failed module migration keeps health available and refuses module calls", async () => {
  const process = await startTestDataProcess({
    modules: { fixture: { ...fixture, migrations: [{ name: "fixture/0001", sql: "NOT SQL;" }] } },
  });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<AppContract & { fixture: typeof fixture.contract }>
  >(new RPCLink({ port: process.openPort() }));
  await expect(client.health()).resolves.toEqual({
    state: "migrationFailed",
    migration: "fixture/0001",
  });
  await expect(client.fixture.add("Invoice")).rejects.toMatchObject({
    code: "SERVICE_UNAVAILABLE",
  });
});

test("unexpected operation errors reach the report sink while the port caller gets a general error", async () => {
  const error = new Error("Private operation detail");
  const broken = defineStorageModule({
    name: "fixture",
    contract: { fail: oc.output(z.string()) },
    migrations: [],
    rowMap: {},
    entries: {
      fail: {
        kind: "operation",
        run() {
          throw error;
        },
      },
    },
  });
  const reports: FrameReport[] = [];
  const process = await startTestDataProcess({
    modules: { fixture: broken },
    report: (value) => {
      reports.push(value);
    },
  });
  started.push(process);
  const client = createORPCClient<ContractRouterClient<{ fixture: typeof broken.contract }>>(
    new RPCLink({ port: process.openPort() }),
  );
  await expect(client.fixture.fail()).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal Server Error",
  });
  expect(reports).toEqual([{ kind: "unexpected-error", entry: "fail", error }]);
});

test("starts with both an owner module and its consumer registered", async () => {
  const { notes, links } = await import("@self-engine/storage/testing");
  const process = await startTestDataProcess({ modules: { notes, links } });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<
      AppContract & {
        notes: typeof notes.contract;
        links: typeof links.contract;
      }
    >
  >(new RPCLink({ port: process.openPort() }));
  await expect(client.health()).resolves.toMatchObject({ state: "ready" });
  const note = await client.notes.create({ title: "Target", isPinned: false });
  const link = await client.links.create({ noteId: note.id, label: "Work" });
  await expect(client.links.list({})).resolves.toEqual([
    {
      ...link,
      noteTitle: "Target",
      noteDeletedAt: null,
    },
  ]);
});

test.each(["health", "tablesChanged"])("startup rejects a module named %s", async (name) => {
  await expect(startTestDataProcess({ modules: { [name]: fixture } })).rejects.toThrow(
    `Module namespace conflicts with built-in procedure: ${name}`,
  );
});

test("registered app module namespaces match the mounted app contract", () => {
  type Namespaces = Exclude<keyof AppContract, "health" | "tablesChanged">;
  expectTypeOf<keyof typeof modules>().toEqualTypeOf<Namespaces>();
  expect(Object.keys(modules).sort()).toEqual(
    Object.keys(appContract)
      .filter((key) => key !== "health" && key !== "tablesChanged")
      .sort(),
  );
});
