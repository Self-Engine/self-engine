import { MessageChannel } from "node:worker_threads";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { RPCHandler } from "@orpc/server/message-port";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { notes } from "../../test/notes-module/data/index.ts";
import { createRouterClient } from "@orpc/server";
import { noteIdSchema, type NoteId } from "../../test/notes-module/data/rows.ts";
import { createFrame, createContext, type StorageModule } from "./index.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function connect(
  module: StorageModule<typeof notes.contract, typeof notes.rowMap> = notes,
  checkOutputs = true,
) {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const router = createFrame(module, { database, sources: createTestContext(), checkOutputs });
  const handler = new RPCHandler(router);
  const channel = new MessageChannel();
  handler.upgrade(channel.port1);
  channel.port2.start();
  cleanups.push(() => {
    channel.port1.close();
    channel.port2.close();
  });
  return createORPCClient<ContractRouterClient<typeof notes.contract>>(
    new RPCLink({ port: channel.port2 }),
  );
}

test("a renderer creates and reads a note through the storage frame", async () => {
  const client = await connect();
  const note = await client.create({ title: "Invoices", isPinned: true });
  expect(note).toMatchObject({
    title: "Invoices",
    isPinned: true,
    createdAt: "2026-11-12T12:00:00.000Z",
  });
  await expect(client.list({})).resolves.toEqual([note]);
});

test.each([true, false])(
  "invalid input is refused before the module runs (outputs: %s)",
  async (checkOutputs) => {
    let calls = 0;
    const module = {
      ...notes,
      entries: {
        ...notes.entries,
        create: {
          kind: "operation" as const,
          async run(...args: Parameters<typeof notes.entries.create.run>) {
            calls++;
            return notes.entries.create.run(...args);
          },
        },
      },
    };
    const client = await connect(module, checkOutputs);
    await expect(client.create({ title: "", isPinned: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(calls).toBe(0);
    await expect(client.list({})).resolves.toEqual([]);
  },
);

test("a failed operation rolls back every write", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const module = {
    ...notes,
    entries: {
      ...notes.entries,
      create: {
        kind: "operation" as const,
        async run(...args: Parameters<typeof notes.entries.create.run>) {
          await notes.entries.create.run(...args);
          throw new Error("Interrupted operation");
        },
      },
    },
  };
  const client = createRouterClient(
    createFrame(module, { database, sources: createTestContext(), checkOutputs: true }),
  );
  await expect(client.create({ title: "Rolled back", isPinned: false })).rejects.toThrow(
    "Interrupted operation",
  );
  await expect(client.list({})).resolves.toEqual([]);
});

test("transaction time is read once, including for branded id generation", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const sources = createTestContext();
  let reads = 0;
  const clock = () => {
    reads++;
    const date = sources.clock();
    sources.advance(1000);
    return date;
  };
  const context = createContext({ ...sources, clock });
  expectTypeOf(context.newId(noteIdSchema)).toEqualTypeOf<NoteId>();
  expect(reads).toBe(1);
  reads = 0;
  const module = {
    ...notes,
    entries: {
      ...notes.entries,
      create: {
        kind: "operation" as const,
        async run(
          tx: Parameters<typeof notes.entries.create.run>[0],
          ctx: Parameters<typeof notes.entries.create.run>[1],
          input: Parameters<typeof notes.entries.create.run>[2],
        ) {
          const first = await notes.entries.create.run(tx, ctx, input);
          const second = await notes.entries.create.run(tx, ctx, { ...input, title: "Second" });
          expect(second.createdAt).toBe(first.createdAt);
          expect(ctx.clock().toISOString()).toBe(first.createdAt);
          return first;
        },
      },
    },
  };
  const client = createRouterClient(
    createFrame(module, { database, sources: { ...sources, clock }, checkOutputs: true }),
  );
  await client.create({ title: "First", isPinned: false });
  const rows = await client.list({});
  expect(rows.map(({ createdAt, updatedAt }) => [createdAt, updatedAt])).toEqual([
    ["2026-11-12T12:00:01.000Z", "2026-11-12T12:00:01.000Z"],
    ["2026-11-12T12:00:01.000Z", "2026-11-12T12:00:01.000Z"],
  ]);
  expect(reads).toBe(2); // one for the operation and one for the query
});

test("output validation rejects and rolls back with checks on, and passes with checks off", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const module = {
    ...notes,
    entries: {
      ...notes.entries,
      create: {
        kind: "operation" as const,
        async run(...args: Parameters<typeof notes.entries.create.run>) {
          const note = await notes.entries.create.run(...args);
          return { ...note, title: 42 } as never;
        },
      },
    },
  };
  for (const checkOutputs of [true, false]) {
    const client = createRouterClient(
      createFrame(module, { database, sources: createTestContext(), checkOutputs }),
    );
    const result = client.create({ title: "Output check", isPinned: false });
    if (checkOutputs) {
      await expect(result).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
      await expect(client.list({})).resolves.toEqual([]);
    } else {
      await expect(result).resolves.toMatchObject({ title: 42 });
      await expect(client.list({})).resolves.toHaveLength(1);
    }
  }
});
