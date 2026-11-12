import type { TablesOf } from "@self-engine/db";
import { MessageChannel } from "node:worker_threads";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { RPCHandler } from "@orpc/server/message-port";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { notes } from "../../test/notes-module/data/index.ts";
import { ORPCError, createRouterClient } from "@orpc/server";
import { noteIdSchema, type NoteId } from "../../test/notes-module/data/rows.ts";
import { createFrame, createContext, type FrameReport, type StorageModule } from "./index.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function connect(
  module: StorageModule<typeof notes.contract, typeof notes.rowMap> = notes,
  checkOutputs = true,
  announce: (tables: ReadonlySet<string>) => void = () => {},
) {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const router = createFrame(module, {
    database,
    sources: createTestContext(),
    checkOutputs,
    announce,
  });
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

test("a failed operation rolls back every write and announces nothing", async () => {
  const announcements: ReadonlySet<string>[] = [];
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
    createFrame(module, {
      database,
      sources: createTestContext(),
      checkOutputs: true,
      announce: (tables) => {
        announcements.push(tables);
      },
    }),
  );
  await expect(client.create({ title: "Rolled back", isPinned: false })).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
  await expect(client.list({})).resolves.toEqual([]);
  expect(announcements).toEqual([]);
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

test("a taken unique title answers CONFLICT, rolls back earlier writes and announces nothing", async () => {
  const announcements: ReadonlySet<string>[] = [];
  const client = await connect(
    {
      ...notes,
      entries: {
        ...notes.entries,
        create: {
          kind: "operation",
          async run(tx, context, input) {
            if (input.isPinned) {
              await notes.entries.create.run(tx, context, {
                title: "Rolled back",
                isPinned: false,
              });
            }
            return notes.entries.create.run(tx, context, input);
          },
        },
      },
    },
    true,
    (tables) => {
      announcements.push(tables);
    },
  );
  const first = await client.create({ title: "Taken", isPinned: false });
  announcements.length = 0;
  await expect(client.create({ title: "Taken", isPinned: true })).rejects.toMatchObject({
    code: "CONFLICT",
    data: { reason: "title_taken" },
  });
  await expect(client.list({})).resolves.toEqual([first]);
  expect(announcements).toEqual([]);
});

test("restoring a taken title answers the create conflict and preserves both rows", async () => {
  const client = await connect();
  const old = await client.create({ title: "Reusable", isPinned: false });
  await client.delete({ id: old.id });
  const replacement = await client.create({ title: "Reusable", isPinned: true });
  await expect(client.restore({ id: old.id })).rejects.toMatchObject({
    code: "CONFLICT",
    data: { reason: "title_taken" },
  });
  await expect(client.list({})).resolves.toEqual([replacement]);
  await client.delete({ id: replacement.id });
  await client.restore({ id: old.id });
  await expect(client.get({ id: old.id })).resolves.toEqual(old);
});

test("a module's own conflict reaches the renderer with its reason", async () => {
  const client = await connect({
    ...notes,
    entries: {
      ...notes.entries,
      create: {
        kind: "operation",
        run() {
          throw new ORPCError("CONFLICT", { data: { reason: "title_taken" } });
        },
      },
    },
  });
  await expect(client.create({ title: "Business rule", isPinned: false })).rejects.toMatchObject({
    code: "CONFLICT",
    data: { reason: "title_taken" },
  });
});

test.each(["absent", "collect", "throw"] as const)(
  "an unmapped unique violation is general to the caller with a %s reporter",
  async (sink) => {
    const database = await createTestDatabase(notes);
    cleanups.push(() => database.close());
    const reports: Extract<FrameReport, { kind: "unexpected-error" }>[] = [];
    const client = createRouterClient(
      createFrame(
        { ...notes, conflicts: {} },
        {
          database,
          sources: createTestContext(),
          checkOutputs: true,
          ...(sink === "absent"
            ? {}
            : {
                report(report: FrameReport) {
                  if (report.kind === "unexpected-error") reports.push(report);
                  if (sink === "throw") throw new Error("Reporter failed");
                },
              }),
        },
      ),
    );
    const first = await client.create({ title: "Private content", isPinned: false });
    await expect(
      client.create({ title: "Private content", isPinned: false }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal Server Error",
      data: undefined,
    });
    await expect(client.list({})).resolves.toEqual([first]);
    if (sink !== "absent") {
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({
        kind: "unexpected-error",
        entry: "create",
        index: "notes_live_title",
        error: {
          code: "SQLITE_CONSTRAINT_UNIQUE",
          message: "UNIQUE constraint failed: notes.space_id, notes.title",
        },
      });
      expect(reports[0]?.error).toBeInstanceOf(Error);
      const error = reports[0]?.error;
      if (!(error instanceof Error)) throw new Error("Expected the original error");
      expect(error.stack).toContain("SqliteError");
    }
  },
);

test("unexpected errors preserve original details only in the report", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const original = new Error("Private failure details");
  const reports: Extract<FrameReport, { kind: "unexpected-error" }>[] = [];
  const client = createRouterClient(
    createFrame(
      {
        ...notes,
        entries: {
          ...notes.entries,
          create: {
            kind: "operation",
            run() {
              throw original;
            },
          },
        },
      },
      {
        database,
        sources: createTestContext(),
        checkOutputs: true,
        report: (event) => {
          if (event.kind === "unexpected-error") reports.push(event);
        },
      },
    ),
  );
  await expect(client.create({ title: "Input", isPinned: false })).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal Server Error",
    data: undefined,
  });
  expect(reports).toEqual([{ kind: "unexpected-error", entry: "create", error: original }]);
  expect(reports[0]?.error).toBe(original);
});

test("a committed operation announces its written table once; a query announces nothing", async () => {
  const announcements: ReadonlySet<string>[] = [];
  const client = await connect(notes, true, (tables) => announcements.push(tables));
  await client.create({ title: "Announced", isPinned: false });
  await client.list({});
  expect(announcements).toEqual([new Set(["notes"])]);
});

test("an operation announces both targets once after commit, including updates and deletes", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  await database.kysely.schema.createTable("local_audit").addColumn("title", "text").execute();
  const module = {
    ...notes,
    entries: {
      ...notes.entries,
      create: {
        kind: "operation" as const,
        async run(...args: Parameters<typeof notes.entries.create.run>) {
          const [tx] = args;
          const note = await notes.entries.create.run(...args);
          await tx
            .updateTable("notes as n")
            .set({ title: "Updated" })
            .where("n.title", "=", note.title)
            .execute();
          const audit = tx.withTables<{ local_audit: { title: string } }>();
          await audit.insertInto("local_audit").values({ title: "Transient" }).execute();
          await audit.deleteFrom("local_audit as a").where("a.title", "=", "Transient").execute();
          return { ...note, title: "Updated" };
        },
      },
    },
  };
  const announcements: ReadonlySet<string>[] = [];
  const reader = createRouterClient(
    createFrame(notes, { database, sources: createTestContext(), checkOutputs: true }),
  );
  const client = createRouterClient(
    createFrame(module, {
      database,
      sources: createTestContext(),
      checkOutputs: true,
      async announce(tables) {
        // A new transaction works only after the operation's transaction has committed.
        await expect(reader.list({})).resolves.toMatchObject([{ title: "Updated" }]);
        announcements.push(tables);
      },
    }),
  );
  await client.create({ title: "Created", isPinned: false });
  expect(announcements).toEqual([new Set(["notes", "local_audit"])]);
});

test.each(["update", "delete"] as const)(
  "a %s announces its target without an insert",
  async (write) => {
    const database = await createTestDatabase(notes);
    cleanups.push(() => database.close());
    const sources = createTestContext();
    const seedNote = await database.kysely
      .transaction()
      .execute(async (tx) =>
        notes.entries.create.run(
          tx.withTables<TablesOf<typeof notes.rowMap>>(),
          createContext(sources),
          { title: "Seed", isPinned: false },
        ),
      );
    const announcements: ReadonlySet<string>[] = [];
    const module = {
      ...notes,
      entries: {
        ...notes.entries,
        create: {
          kind: "operation" as const,
          async run(tx: Parameters<typeof notes.entries.create.run>[0]) {
            if (write === "update")
              await tx
                .updateTable("notes as n")
                .set({ title: "Updated" })
                .where("n.title", "=", "Seed")
                .execute();
            else await tx.deleteFrom("notes as n").where("n.title", "=", "Seed").execute();
            return seedNote;
          },
        },
      },
    };
    const client = createRouterClient(
      createFrame(module, {
        database,
        sources,
        checkOutputs: true,
        announce: (tables) => {
          announcements.push(tables);
        },
      }),
    );
    await client.create({ title: "Unused", isPinned: false });
    expect(announcements).toEqual([new Set(["notes"])]);
  },
);

test("zero-row writes and compiled but unexecuted writes announce nothing", async () => {
  const announcements: ReadonlySet<string>[] = [];
  const module = {
    ...notes,
    entries: {
      ...notes.entries,
      list: {
        ...notes.entries.list,
        kind: "operation" as const,
        async run(tx: Parameters<typeof notes.entries.create.run>[0]) {
          await tx
            .updateTable("notes")
            .set({ title: "Missing" })
            .where("title", "=", "Absent")
            .execute();
          await tx.deleteFrom("notes").where("title", "=", "Absent").execute();
          const row = await tx.selectFrom("notes").selectAll().executeTakeFirst();
          if (row === undefined) throw new Error("Missing seed");
          await tx
            .insertInto("notes")
            .values(row)
            .onConflict((conflict) => conflict.doNothing())
            .execute();
          tx.deleteFrom("notes").compile();
          return [];
        },
      },
    },
  };
  const client = await connect(module, true, (tables) => {
    announcements.push(tables);
  });
  await client.create({ title: "Seed", isPinned: false });
  announcements.length = 0;
  await client.list({});
  expect(announcements).toEqual([]);
});

test("a write attempted inside a query fails and announces nothing", async () => {
  const announcements: ReadonlySet<string>[] = [];
  const module = {
    ...notes,
    entries: {
      ...notes.entries,
      list: {
        kind: "query" as const,
        async run(
          tx: Parameters<typeof notes.entries.list.run>[0],
          context: Parameters<typeof notes.entries.list.run>[1],
        ) {
          // Simulate an untyped consumer trying to escape the query's read-only interface.
          await notes.entries.create.run(
            tx as Parameters<typeof notes.entries.create.run>[0],
            context,
            { title: "Forbidden", isPinned: false },
          );
          return [];
        },
      },
    },
  };
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const options = {
    database,
    sources: createTestContext(),
    checkOutputs: true,
    announce: (tables: ReadonlySet<string>) => {
      announcements.push(tables);
    },
  };
  const client = createRouterClient(createFrame(module, options));
  await expect(client.list({})).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal Server Error",
  });
  const reader = createRouterClient(createFrame(notes, options));
  await expect(reader.list({})).resolves.toEqual([]);
  expect(announcements).toEqual([]);
});

test("a write without an affected-row count is announced", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  // Model a dialect that returns rows but no affected-row count at the database boundary.
  const withoutCounts = {
    ...database,
    kysely: database.kysely.withPlugin({
      transformQuery: ({ node }) => node,
      async transformResult({ result }) {
        const { numAffectedRows: _count, ...withoutCount } = result;
        return withoutCount;
      },
    }),
  };
  const announcements: ReadonlySet<string>[] = [];
  const client = createRouterClient(
    createFrame(notes, {
      database: withoutCounts,
      sources: createTestContext(),
      checkOutputs: true,
      announce: (tables) => {
        announcements.push(tables);
      },
    }),
  );
  await client.create({ title: "Unknown count", isPinned: false });
  expect(announcements).toEqual([new Set(["notes"])]);
});

test("interleaved write results count only the target whose statement affected rows", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  await database.kysely.schema.createTable("local_audit").addColumn("title", "text").execute();
  const sources = createTestContext();
  const seedNote = await database.kysely
    .transaction()
    .execute(async (tx) =>
      notes.entries.create.run(
        tx.withTables<TablesOf<typeof notes.rowMap>>(),
        createContext(sources),
        { title: "Seed", isPinned: false },
      ),
    );
  const module = {
    ...notes,
    entries: {
      ...notes.entries,
      create: {
        kind: "operation" as const,
        async run(tx: Parameters<typeof notes.entries.create.run>[0]) {
          const audit = tx.withTables<{ local_audit: { title: string } }>();
          await Promise.all([
            tx.updateTable("notes").set({ title: "Changed" }).execute(),
            audit.updateTable("local_audit").set({ title: "Missing" }).execute(),
          ]);
          await audit.selectFrom("local_audit").selectAll().execute();
          return { ...seedNote, title: "Changed" };
        },
      },
    },
  };
  const announcements: ReadonlySet<string>[] = [];
  const client = createRouterClient(
    createFrame(module, {
      database,
      sources,
      checkOutputs: true,
      announce: (tables) => {
        announcements.push(tables);
      },
    }),
  );
  await client.create({ title: "Unused", isPinned: false });
  expect(announcements).toEqual([new Set(["notes"])]);
});

test("a failing announcer reports its error and returns the committed result", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const error = new Error("Announcement failed");
  const reports: FrameReport[] = [];
  const client = createRouterClient(
    createFrame(notes, {
      database,
      sources: createTestContext(),
      checkOutputs: true,
      announce() {
        throw error;
      },
      report(event) {
        reports.push(event);
      },
    }),
  );
  const note = await client.create({ title: "Committed", isPinned: false });
  await expect(client.get({ id: note.id })).resolves.toEqual(note);
  expect(reports).toEqual([{ kind: "unexpected-error", entry: "create", error }]);
});

test("failed unique-index diagnostics preserve the original error", async () => {
  const database = await createTestDatabase(notes);
  cleanups.push(() => database.close());
  const diagnosticFailure = new Error("Diagnostics unavailable");
  const observed = {
    ...database,
    kysely: database.kysely.withPlugin({
      transformQuery({ node }) {
        if (JSON.stringify(node).includes("pragma_")) throw diagnosticFailure;
        return node;
      },
      async transformResult({ result }) {
        return result;
      },
    }),
  };
  const reports: FrameReport[] = [];
  const client = createRouterClient(
    createFrame(notes, {
      database: observed,
      sources: createTestContext(),
      checkOutputs: true,
      report(event) {
        reports.push(event);
      },
    }),
  );
  const note = await client.create({ title: "Taken", isPinned: false });
  await expect(client.create({ title: "Taken", isPinned: false })).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
  expect(reports).toMatchObject([
    {
      kind: "unexpected-error",
      entry: "create",
      error: { code: "SQLITE_CONSTRAINT_UNIQUE" },
    },
  ]);
  await expect(client.list({})).resolves.toEqual([note]);
});
