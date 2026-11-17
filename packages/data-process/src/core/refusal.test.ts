import { createORPCClient, isDefinedError, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { matchReason } from "@self-engine/db/schema";
import { links, notes, pinnedNote } from "@self-engine/storage/testing";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

async function start() {
  const process = await startTestDataProcess({ modules: { notes, links } });
  started.push(process);
  return createORPCClient<
    ContractRouterClient<
      ProtocolContract & { notes: typeof notes.contract; links: typeof links.contract }
    >
  >(new RPCLink({ port: process.openPort() }));
}

test("a write a module's rule forbids arrives at the Port as a Refusal with typed Reasons", async () => {
  const client = await start();
  const note = await client.notes.create({ title: "Keep", isPinned: true });

  const { error } = await safe(client.notes.delete({ id: note.id }));

  if (!isDefinedError(error) || error.code !== "REFUSED") throw new Error("Expected a Refusal");
  expect(error.data.reasons).toEqual([
    { code: "pinned", severity: "blocking", table: "notes", row: note.id, details: { title: "Keep" } },
  ]);
  const pinned = matchReason(pinnedNote, error.data.reasons[0]!);
  expectTypeOf(pinned?.details).toEqualTypeOf<{ title: string } | undefined>();
  expect(pinned?.details.title).toBe("Keep");
});

test("after a Refusal the row is unchanged and no Table Change was announced", async () => {
  const client = await start();
  const note = await client.notes.create({ title: "Keep", isPinned: true });
  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toMatchObject({ value: { kind: "opened" } });

  await expect(client.notes.delete({ id: note.id })).rejects.toMatchObject({ code: "REFUSED" });
  await client.links.create({ noteId: note.id, label: "After" });

  await expect(client.notes.get({ id: note.id })).resolves.toEqual(note);
  // The first event after the Refusal is the link's: the refused delete announced nothing.
  await expect(events.next()).resolves.toEqual({
    done: false,
    value: { kind: "changed", tables: ["note_links"] },
  });
  await events.return();
});

test("a write the rule does not forbid goes through", async () => {
  const client = await start();
  const note = await client.notes.create({ title: "Loose", isPinned: false });
  await expect(client.notes.delete({ id: note.id })).resolves.toMatchObject({ id: note.id });
});
