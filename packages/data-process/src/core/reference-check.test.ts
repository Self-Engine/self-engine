import { createORPCClient, isDefinedError, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { matchReason, referenced } from "@self-engine/db/schema";
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
