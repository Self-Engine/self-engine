import type { TablesOf } from "@self-engine/db";
import { createRouterClient } from "@orpc/server";
import { expect, test } from "vite-plus/test";
import { notes } from "../../test/notes-module/data/index.ts";
import { createFrame } from "./index.ts";
import { createTestContext, createTestDatabase } from "../testing/index.ts";

test("standard writes preserve creation time and move update and deletion times", async () => {
  const database = await createTestDatabase(notes);
  try {
    const sources = createTestContext();
    const client = createRouterClient(
      createFrame(notes, { database, sources, checkOutputs: true }),
    );
    const note = await client.create({ title: "First", isPinned: false });
    expect(note).toMatchObject({
      title: "First",
      isPinned: false,
      createdAt: "2026-11-12T12:00:00.000Z",
      updatedAt: "2026-11-12T12:00:00.000Z",
    });
    await expect(client.get({ id: note.id })).resolves.toEqual(note);
    sources.advance(1000);
    const updated = await client.update({ id: note.id, title: "Changed" });
    expect(updated).toEqual({ ...note, title: "Changed", updatedAt: "2026-11-12T12:00:01.000Z" });
    await expect(client.get({ id: note.id })).resolves.toEqual(updated);
    sources.advance(1000);
    await expect(client.delete({ id: note.id })).resolves.toMatchObject({
      created_at: "2026-11-12T12:00:00.000Z",
      updated_at: "2026-11-12T12:00:02.000Z",
      deleted_at: "2026-11-12T12:00:02.000Z",
    });
    await expect(client.list({})).resolves.toEqual([]);
    sources.advance(1000);
    await expect(client.restore({ id: note.id })).resolves.toMatchObject({
      created_at: "2026-11-12T12:00:00.000Z",
      updated_at: "2026-11-12T12:00:03.000Z",
      deleted_at: null,
    });
    await expect(client.get({ id: note.id })).resolves.toMatchObject({ title: "Changed" });
  } finally {
    await database.close();
  }
});

test.each(["get", "update", "delete"] as const)(
  "%s answers NOT_FOUND for unknown and deleted ids",
  async (entry) => {
    const database = await createTestDatabase(notes);
    try {
      const client = createRouterClient(
        createFrame(notes, { database, sources: createTestContext(), checkOutputs: true }),
      );
      const note = await client.create({ title: "Gone", isPinned: false });
      await client.delete({ id: note.id });
      for (const id of [note.id, "00000000-0000-7000-8000-000000000099" as typeof note.id]) {
        await expect(client[entry]({ id, title: "Changed" })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
    } finally {
      await database.close();
    }
  },
);

test("the shared entry rejects Local Tables, even with convention-shaped columns", async () => {
  const { sharedEntry, sharedWrites, createContext } = await import("./index.ts");
  const database = await createTestDatabase(notes);
  try {
    await database.kysely.transaction().execute(async (transaction) => {
      const tx = transaction.withTables<{
        local_notes: typeof notes.rowMap.notes._output;
        local_cache: { key: string };
      }>();
      const context = createContext(createTestContext());
      const reads = sharedEntry(tx, context);
      const writes = sharedWrites(tx, context);
      // @ts-expect-error Local Tables are excluded even if they have convention columns.
      expect(() => reads.live("local_notes")).toThrow("requires a synchronized table");
      // @ts-expect-error Free-shaped Local Tables cannot use the shared entry.
      expect(() => reads.live("local_cache")).toThrow("requires a synchronized table");
      await expect(
        // @ts-expect-error Local Tables cannot use standard writes.
        writes.insert("local_notes", "id", { title: "Local", is_pinned: 0 }),
      ).rejects.toThrow("requires a synchronized table");
    });
  } finally {
    await database.close();
  }
});

test("another Space's row is absent from lookup and every single-row change", async () => {
  const { createContext, sharedWrites, spaceIdSchema } = await import("./index.ts");
  const { noteIdSchema } = await import("../../test/notes-module/data/rows.ts");
  const database = await createTestDatabase(notes);
  try {
    const sources = createTestContext();
    const context = {
      ...createContext(sources),
      spaceId: spaceIdSchema.parse("00000000-0000-7000-8000-000000000002"),
    };
    const id = context.newId(noteIdSchema);
    await database.kysely.transaction().execute((tx) =>
      sharedWrites(tx.withTables<TablesOf<typeof notes.rowMap>>(), context).insert("notes", id, {
        title: "Foreign",
        is_pinned: 0,
      }),
    );
    const client = createRouterClient(
      createFrame(notes, { database, sources, checkOutputs: true }),
    );
    await expect(client.list({})).resolves.toEqual([]);
    for (const entry of ["get", "update", "delete", "restore"] as const) {
      await expect(client[entry]({ id, title: "Changed" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  } finally {
    await database.close();
  }
});
