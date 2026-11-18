import { createORPCClient, isDefinedError, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import type { TablesOf } from "@self-engine/db";
import { defineReason, matchReason } from "@self-engine/db/schema";
import { createTestSources } from "@self-engine/db/testing";
import { createContext, protectionRule, sharedEntry } from "@self-engine/storage";
import { links, notes } from "@self-engine/storage/testing";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

// A rule from above for a table of `notes`, as the composition registers one for a later Bridge
// (D331). The Reason belongs to the side that registers the rule; `notes` imports nothing of it.
const exportedNote = defineReason("exported", z.object({ title: z.string() }));
const exportedNotesStay = protectionRule(notes.rowMap, {
  table: "notes",
  write: "delete",
  reasons: [exportedNote],
  async answer(tx, context, rows) {
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
});

const sources = createTestSources("2026-01-01T00:00:00.000Z");

async function start() {
  const process = await startTestDataProcess({
    modules: { notes, links },
    rules: [exportedNotesStay],
    sources,
  });
  started.push(process);
  const client = createORPCClient<
    ContractRouterClient<ProtocolContract & { notes: typeof notes.contract }>
  >(new RPCLink({ port: process.openPort() }));
  return { process, client };
}

test("a rule from above refuses a write through the module's own Operation with its own Reason", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Exported plan", isPinned: false });

  const { error } = await safe(client.notes.delete({ id: note.id }));

  if (!isDefinedError(error) || error.code !== "REFUSED") throw new Error("Expected a Refusal");
  const { reasons } = error.data;
  expect(reasons).toEqual([
    {
      code: "exported",
      severity: "blocking",
      table: "notes",
      row: note.id,
      details: { title: "Exported plan" },
    },
  ]);
  const exported = matchReason(exportedNote, reasons[0]!);
  expectTypeOf(exported?.details).toEqualTypeOf<{ title: string } | undefined>();
  await expect(client.notes.get({ id: note.id })).resolves.toEqual(note);
});

test("when the module's rule and a rule from above both forbid a write, the Refusal carries both Reasons", async () => {
  const { client } = await start();
  const note = await client.notes.create({ title: "Exported and pinned", isPinned: true });

  const { error } = await safe(client.notes.delete({ id: note.id }));

  if (!isDefinedError(error) || error.code !== "REFUSED") throw new Error("Expected a Refusal");
  expect(error.data.reasons.map((reason) => reason.code).toSorted()).toEqual([
    "exported",
    "pinned",
  ]);
});

test("a lower function called in a foreign transaction is refused with the same Reasons and writes nothing", async () => {
  const { process, client } = await start();
  const note = await client.notes.create({ title: "Exported and pinned", isPinned: true });
  // A Bridge builds its context from the sources the frames get: the Space and the same rules.
  const context = createContext(process.contextSources!);

  const flow = process.database.kysely.transaction().execute(async (transaction) => {
    const tx = transaction.withTables<TablesOf<typeof notes.rowMap>>();
    await tx.updateTable("notes").set({ title: "Exported and touched" }).execute();
    return notes.entries.delete.run(tx, context, { id: note.id }, "delete", "notes");
  });

  await expect(flow).rejects.toMatchObject({
    code: "REFUSED",
    data: {
      reasons: expect.arrayContaining([
        expect.objectContaining({ code: "pinned", row: note.id }),
        expect.objectContaining({ code: "exported", row: note.id }),
      ]),
    },
  });
  // The foreign transaction rolled back with the Refusal: the flow's own write is gone too.
  await expect(client.notes.get({ id: note.id })).resolves.toEqual(note);
});

test("a rule for a table no mounted module has fails the start", async () => {
  await expect(
    startTestDataProcess({
      modules: { links },
      // @ts-expect-error `notes` is not mounted, so the composition cannot guard its table.
      rules: [exportedNotesStay],
    }),
  ).rejects.toThrow("guards notes, which no mounted module has");
});

test("a rule for a Local Table fails the start", async () => {
  const drafts = {
    name: "drafts",
    migrations: [],
    contract: {},
    rowMap: { local_drafts: z.object({ id: z.string() }) },
    entries: {},
  };
  const draftsStay = { ...exportedNotesStay, table: "local_drafts" as const };
  await expect(
    startTestDataProcess({
      modules: { notes, drafts },
      // @ts-expect-error A Local Table has no rules: no write path writes it.
      rules: [draftsStay],
    }),
  ).rejects.toThrow("guards local_drafts, which no mounted module has as a synced table");
});
