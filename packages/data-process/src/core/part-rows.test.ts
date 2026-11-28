import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { baskets, notes } from "@self-engine/storage/testing";
import { afterEach, expect, test } from "vite-plus/test";
import { startTestDataProcess, type TestDataProcess } from "../testing/index.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

async function start() {
  const process = await startTestDataProcess({ modules: { notes, baskets } });
  started.push(process);
  return createORPCClient<
    ContractRouterClient<
      ProtocolContract & { notes: typeof notes.contract; baskets: typeof baskets.contract }
    >
  >(new RPCLink({ port: process.openPort() }));
}

test("the Data Process knows the Part Rows its modules declare (ADR 0042)", async () => {
  const client = await start();
  const note = await client.notes.create({ title: "Target", isPinned: false });
  const basket = await client.baskets.create({ title: "Basket" });
  const item = await client.baskets.addItem({ basketId: basket.id, noteId: note.id });
  await client.baskets.mark({ noteId: note.id, label: "Mark" });

  await expect(client.notes.delete({ id: note.id })).rejects.toMatchObject({ code: "REFUSED" });
  await client.baskets.delete({ id: basket.id });
  await expect(client.baskets.removeItem({ id: item.id })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(client.notes.delete({ id: note.id })).resolves.toMatchObject({ id: note.id });
  await expect(client.baskets.marks({})).resolves.toEqual([]);
  await expect(
    client.clearance({ table: "baskets", rows: [basket.id], writes: ["restore"] }),
  ).resolves.toMatchObject([{ writes: { restore: { state: "blocked" } } }]);
});

test("an owner reference the schema does not hold fails the start", async () => {
  const broken = { ...baskets, belongsTo: { note_marks: "label" } } as unknown as typeof baskets;
  await expect(startTestDataProcess({ modules: { notes, baskets: broken } })).rejects.toThrow(
    "note_marks.label is named as the owner of a Part Row",
  );
});
