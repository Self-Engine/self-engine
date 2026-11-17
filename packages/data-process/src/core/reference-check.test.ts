import { createORPCClient, isDefinedError, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { idSchema, matchReason, referenced, targetDeleted } from "@self-engine/db/schema";
import { links, notes } from "@self-engine/storage/testing";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

async function start() {
  const process = await startTestDataProcess({ modules: { notes, links } });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<
      ProtocolContract & { notes: typeof notes.contract; links: typeof links.contract }
    >
  >(new RPCLink({ port: process.openPort() }));
  return { process, client };
}

test("a note a Live Row refers to is refused with the referring table and its count, and nothing is written", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  await client.links.create({ noteId: note.id, label: "First" });
  await client.links.create({ noteId: note.id, label: "Second" });

  const { error } = await safe(client.notes.delete({ id: note.id }));

  if (!isDefinedError(error) || error.code !== "REFUSED") throw new Error("Expected a Refusal");
  expect(error.data.reasons).toEqual([
    {
      code: "referenced",
      severity: "blocking",
      row: note.id,
      details: { tables: [{ table: "note_links", count: 2 }] },
    },
  ]);
  const reason = matchReason(referenced, error.data.reasons[0]!);
  expectTypeOf(reason?.details.tables).toEqualTypeOf<
    { table: string; count: number }[] | undefined
  >();
  await expect(client.notes.get({ id: note.id })).resolves.toEqual(note);
});

test("a note is deleted once every link to it is deleted", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  const link = await client.links.create({ noteId: note.id, label: "Only" });
  await expect(client.notes.delete({ id: note.id })).rejects.toMatchObject({ code: "REFUSED" });

  await client.links.delete({ id: link.id });

  await expect(client.notes.delete({ id: note.id })).resolves.toMatchObject({ id: note.id });
});

test("the references are read once at the start, after the migrations, and not per call", async () => {
  const { process, client } = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  // A reference that appears after the start is not one the Data Process knows.
  await process.database.executeScript(`
    CREATE TABLE note_pins (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED,
      note_id TEXT NOT NULL REFERENCES notes(id) DEFERRABLE INITIALLY DEFERRED
    ) STRICT;
    INSERT INTO note_pins
      SELECT '01a1c0a2-f079-7000-8000-000000000099', created_at, created_at, NULL, space_id, id
      FROM notes WHERE id = '${note.id}';
  `);

  await expect(client.notes.delete({ id: note.id })).resolves.toMatchObject({ id: note.id });
});

/** The Refusal of a write whose reference names a note that is deleted, unknown or foreign. */
function refusedFor(link: string, note: string) {
  return {
    code: "target_deleted",
    severity: "blocking",
    row: link,
    field: "note_id",
    details: { target: { table: "notes", id: note } },
  };
}

async function reasonsOf(write: Promise<unknown>) {
  const error: unknown = await write.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toMatchObject({ code: "REFUSED" });
  return (error as { data: { reasons: unknown[] } }).data.reasons;
}

test("a link whose note is deleted is not restored until the note is back, and the Refusal names the field and the note", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  const link = await client.links.create({ noteId: note.id, label: "Only" });
  await client.links.delete({ id: link.id });
  await client.notes.delete({ id: note.id });

  const { error } = await safe(client.links.restore({ id: link.id }));

  if (!isDefinedError(error) || error.code !== "REFUSED") throw new Error("Expected a Refusal");
  expect(error.data.reasons).toEqual([refusedFor(link.id, note.id)]);
  const reason = matchReason(targetDeleted, error.data.reasons[0]!);
  expectTypeOf(reason?.details.target).toEqualTypeOf<{ table: string; id: string } | undefined>();
  await expect(client.links.list({})).resolves.toEqual([]);

  await client.notes.restore({ id: note.id });
  await expect(client.links.restore({ id: link.id })).resolves.toMatchObject({ id: link.id });
});

test("a link to a deleted note is not inserted and nothing is written", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  await client.notes.delete({ id: note.id });

  const reasons = await reasonsOf(client.links.create({ noteId: note.id, label: "Late" }));

  expect(reasons).toEqual([refusedFor((reasons[0] as { row: string }).row, note.id)]);
  await expect(client.links.list({})).resolves.toEqual([]);
});

test("a link moved to a deleted note is refused the same way and keeps its note", async () => {
  const { client } = await start();
  const kept = await client.notes.create({ title: "Kept", isPinned: false });
  const gone = await client.notes.create({ title: "Gone", isPinned: false });
  await client.notes.delete({ id: gone.id });
  const link = await client.links.create({ noteId: kept.id, label: "Moving" });

  await expect(reasonsOf(client.links.update({ id: link.id, noteId: gone.id }))).resolves.toEqual([
    refusedFor(link.id, gone.id),
  ]);
  await expect(client.links.list({})).resolves.toMatchObject([{ id: link.id, noteId: kept.id }]);
});

test("a link to an unknown note is a Refusal, not an unexpected error", async () => {
  const { client } = await start();
  const unknown = idSchema("Note").parse("01a1c0a2-f079-7000-8000-0000000000ff");

  const reasons = await reasonsOf(client.links.create({ noteId: unknown, label: "Nowhere" }));

  expect(reasons).toEqual([refusedFor((reasons[0] as { row: string }).row, unknown)]);
});
