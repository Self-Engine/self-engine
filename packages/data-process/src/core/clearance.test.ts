import { createORPCClient, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { defineReason } from "@self-engine/db/schema";
import { protectionRule, sharedEntry } from "@self-engine/storage";
import { links, notes } from "@self-engine/storage/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { z } from "zod";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

// A rule from above, as in `rules-from-above.test.ts`, that also counts the rows of each call.
const exportedNote = defineReason("exported", z.object({ title: z.string() }));
const calls: number[] = [];
const exportedNotesStay = protectionRule(notes.rowMap, {
  table: "notes",
  write: "delete",
  reasons: [exportedNote],
  async answer(tx, context, rows) {
    calls.push(rows.length);
    const exported = await sharedEntry(tx, context)
      .live("notes")
      .select(["id", "title"])
      .where(
        "id",
        "in",
        rows.map((row) => row.id),
      )
      .where("title", "like", "Exported%")
      .execute();
    return exported.map((note) => ({
      code: exportedNote.code,
      row: note.id,
      details: { title: note.title },
    }));
  },
});

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
  calls.length = 0;
});

async function start() {
  const process = await startTestDataProcess({
    modules: { notes, links },
    rules: [exportedNotesStay],
  });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<
      ProtocolContract & { notes: typeof notes.contract; links: typeof links.contract }
    >
  >(new RPCLink({ port: process.openPort() }));
  return { process, client };
}

/** The Reasons of the Refusal a write answers with. */
async function refusalOf(write: Promise<unknown>) {
  const { error } = await safe(write);
  expect(error).toMatchObject({ code: "REFUSED" });
  return (error as unknown as { data: { reasons: unknown[] } }).data.reasons;
}

test("a note a Live Row refers to is blocked for delete with the Reason the delete returns", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  await client.links.create({ noteId: note.id, label: "Only" });

  const answer = await client.clearance({ table: "notes", rows: [note.id], writes: ["delete"] });

  expect(answer).toEqual([
    {
      row: note.id,
      writes: {
        delete: {
          state: "blocked",
          reasons: await refusalOf(client.notes.delete({ id: note.id })),
        },
      },
    },
  ]);
  expect(answer[0]?.writes.delete).toMatchObject({
    reasons: [{ code: "referenced", table: "notes", row: note.id }],
  });
});

test("a link whose note is deleted is blocked for restore with the Reason the restore returns", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  const link = await client.links.create({ noteId: note.id, label: "Only" });
  await client.links.delete({ id: link.id });
  await client.notes.delete({ id: note.id });

  const answer = await client.clearance({
    table: "note_links",
    rows: [link.id],
    writes: ["restore"],
  });

  expect(answer).toEqual([
    {
      row: link.id,
      writes: {
        restore: {
          state: "blocked",
          reasons: await refusalOf(client.links.restore({ id: link.id })),
        },
      },
    },
  ]);
  expect(answer[0]?.writes.restore).toMatchObject({
    reasons: [{ code: "target_deleted", table: "note_links", field: "note_id" }],
  });
});

test("a row nothing stands against is free for each asked kind of write, and only those are answered", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Free", isPinned: false });

  await expect(
    client.clearance({ table: "notes", rows: [note.id], writes: ["update", "delete"] }),
  ).resolves.toEqual([
    { row: note.id, writes: { update: { state: "free" }, delete: { state: "free" } } },
  ]);
});

test("several rows are answered per row in one call; a module's rule and a rule from above both answer, each once for the set", async () => {
  const { client } = await start();
  const pinned = await client.notes.create({ title: "Pinned", isPinned: true });
  const exported = await client.notes.create({ title: "Exported plan", isPinned: false });
  const free = await client.notes.create({ title: "Free", isPinned: false });

  const answer = await client.clearance({
    table: "notes",
    rows: [pinned.id, exported.id, free.id],
    writes: ["delete"],
  });

  expect(answer).toEqual([
    {
      row: pinned.id,
      writes: {
        delete: {
          state: "blocked",
          reasons: [
            {
              code: "pinned",
              severity: "blocking",
              table: "notes",
              row: pinned.id,
              details: { title: "Pinned" },
            },
          ],
        },
      },
    },
    {
      row: exported.id,
      writes: {
        delete: {
          state: "blocked",
          reasons: [
            {
              code: "exported",
              severity: "blocking",
              table: "notes",
              row: exported.id,
              details: { title: "Exported plan" },
            },
          ],
        },
      },
    },
    { row: free.id, writes: { delete: { state: "free" } } },
  ]);
  expect(calls).toEqual([3]);
});

test("the Clearance writes nothing and announces no Table Change", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Pinned", isPinned: true });
  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });

  await client.clearance({
    table: "notes",
    rows: [note.id],
    writes: ["update", "delete", "restore"],
  });
  // The next Table Change is the one of this write, not one of the Clearance.
  await client.notes.update({ id: note.id, title: "Touched" });

  await expect(events.next()).resolves.toEqual({
    done: false,
    value: { kind: "changed", tables: ["notes"] },
  });
  await expect(client.notes.get({ id: note.id })).resolves.toMatchObject({
    title: "Touched",
    updatedAt: note.updatedAt,
  });
});

test("a row that is unknown, of another Space, or not in the state a write needs is not found, unlike a free row", async () => {
  const { process, client } = await start();
  const live = await client.notes.create({ title: "Live", isPinned: false });
  const gone = await client.notes.create({ title: "Gone", isPinned: false });
  await client.notes.delete({ id: gone.id });
  const unknown = "01a1c0a2-f079-7000-8000-0000000000ff";
  const foreign = "01a1c0a2-f079-7000-8000-0000000000fe";
  await process.database.executeScript(`
    INSERT INTO spaces VALUES ('${foreign}', '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z', NULL, '${foreign}', 'shared');
    INSERT INTO notes VALUES ('${foreign}', '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z', NULL, '${foreign}', 'Foreign', 0);
  `);

  await expect(
    client.clearance({
      table: "notes",
      rows: [live.id, gone.id, unknown, foreign],
      writes: ["delete", "restore"],
    }),
  ).resolves.toEqual([
    { row: live.id, writes: { delete: { state: "free" }, restore: { state: "notFound" } } },
    { row: gone.id, writes: { delete: { state: "notFound" }, restore: { state: "free" } } },
    { row: unknown, writes: { delete: { state: "notFound" }, restore: { state: "notFound" } } },
    { row: foreign, writes: { delete: { state: "notFound" }, restore: { state: "notFound" } } },
  ]);
});

test("a table no mounted module has, or archive of a table that cannot be archived, is invalid input", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Free", isPinned: false });

  await expect(
    client.clearance({ table: "projects", rows: [note.id], writes: ["delete"] }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    client.clearance({ table: "notes", rows: [note.id], writes: ["archive"] }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
