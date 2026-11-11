import { MessageChannel } from "node:worker_threads";
import { oc, ORPCError } from "@orpc/contract";
import { implement } from "@orpc/server";
import { appContract } from "@self-engine/contracts";
import { createDataClient } from "@self-engine/data-client";
import type { Database, Migration } from "@self-engine/db";
import { openDatabase } from "@self-engine/db/better-sqlite3";
import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import { createDataProcessCore } from "./index.ts";
import type { DataProcessCore, ModuleRouters, ProcedureContext } from "./index.ts";

/** A module of this test only: one table and a procedure that reads it. */
const notesContract = {
  count: oc.input(z.object({ startingWith: z.string() })).output(z.number()),
};
const notesMigration: Migration = {
  name: "notes/0001",
  sql: "CREATE TABLE notes (id TEXT PRIMARY KEY, text TEXT NOT NULL) STRICT;",
};

function notesRouter(): ModuleRouters {
  const notes = implement(notesContract).$context<ProcedureContext>();
  return {
    notes: notes.router({
      count: notes.count.handler(async ({ context, input }) => {
        const { rows } = await sql<{ count: number }>`
          SELECT count(*) AS count FROM notes WHERE text LIKE ${`${input.startingWith}%`}
        `.execute(context.database.kysely);
        return rows[0]?.count ?? 0;
      }),
    }),
  };
}

type TestContract = typeof appContract & { notes: typeof notesContract };

let database: Database;
const channels: MessageChannel[] = [];

/** A client connected to `core` over a fresh in-memory channel, as the renderer would be. */
function connect<Contract extends typeof appContract = typeof appContract>(core: DataProcessCore) {
  const channel = new MessageChannel();
  channels.push(channel);
  core.serve(channel.port1);
  return createDataClient<Contract>(channel.port2);
}

beforeEach(() => {
  database = openDatabase(":memory:");
});

afterEach(async () => {
  for (const channel of channels.splice(0)) {
    channel.port1.close();
    channel.port2.close();
  }
  await database.close();
});

describe("a typed call from the client", () => {
  test("gets health as ready, with the SQLite version and no migrations", async () => {
    const client = connect(await createDataProcessCore({ database, migrations: [] }));

    await expect(client.health()).resolves.toEqual({
      state: "ready",
      sqliteVersion: expect.stringMatching(/^3\.\d+\.\d+$/),
      migrations: [],
    });
  });

  test("is answered only after every migration has run", async () => {
    const core = await createDataProcessCore({
      database,
      migrations: [notesMigration],
      modules: notesRouter(),
    });
    const client = connect<TestContract>(core);

    // The first call reads the table the migration creates.
    await expect(client.notes.count({ startingWith: "a" })).resolves.toBe(0);
    await expect(client.health()).resolves.toMatchObject({ migrations: ["notes/0001"] });
  });

  test("reports the applied migrations in the order they ran", async () => {
    const client = connect(
      await createDataProcessCore({
        database,
        migrations: [
          { name: "time/0001", sql: "CREATE TABLE time_entries (id TEXT PRIMARY KEY) STRICT;" },
          notesMigration,
        ],
      }),
    );

    await expect(client.health()).resolves.toMatchObject({
      migrations: ["notes/0001", "time/0001"],
    });
  });

  test("with input that breaks its schema is refused by the data process (D188)", async () => {
    const client = connect<TestContract>(
      await createDataProcessCore({
        database,
        migrations: [notesMigration],
        modules: notesRouter(),
      }),
    );

    // The client checks nothing (D188), so the refusal comes from the data process.
    const call = client.notes.count({ startingWith: 3 as unknown as string });
    await expect(call).rejects.toBeInstanceOf(ORPCError);
    await expect(call).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("answers on every port it is given, one per connection", async () => {
    const core = await createDataProcessCore({ database, migrations: [] });
    const first = connect(core);
    const second = connect(core);

    await expect(first.health()).resolves.toMatchObject({ state: "ready" });
    await expect(second.health()).resolves.toMatchObject({ state: "ready" });
  });
});

describe("the module procedures", () => {
  test("may not take a name of the app contract", async () => {
    const modules = { health: notesRouter()["notes"] } as ModuleRouters;

    await expect(createDataProcessCore({ database, migrations: [], modules })).rejects.toThrow(
      /may not be named health/,
    );
  });
});
