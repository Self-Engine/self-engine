// The app contract has no procedure with input yet, so a fixture contract checks that the
// data process's port server refuses a call whose input breaks its schema (D188), before the
// handler runs. The renderer never validates, so this is the only check.

import { MessageChannel } from "node:worker_threads";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { type ContractRouterClient, oc } from "@orpc/contract";
import { implement } from "@orpc/server";
import { afterEach, expect, test } from "vite-plus/test";
import { z } from "zod";
import { createPortServer } from "./serve.ts";

const fixtureContract = {
  rename: oc.input(z.object({ name: z.string().min(1) })).output(z.string()),
};

const ports: MessageChannel[] = [];

afterEach(() => {
  for (const { port1, port2 } of ports.splice(0)) {
    port1.close();
    port2.close();
  }
});

function connect(handled: string[]): ContractRouterClient<typeof fixtureContract> {
  const implementer = implement(fixtureContract);
  const serve = createPortServer({
    rename: implementer.rename.handler(({ input }) => {
      handled.push(input.name);
      return input.name;
    }),
  });
  const channel = new MessageChannel();
  ports.push(channel);
  serve(channel.port1);
  channel.port2.start();
  return createORPCClient(new RPCLink({ port: channel.port2 }));
}

test("answers a call whose input fits its schema", async () => {
  const handled: string[] = [];
  const client = connect(handled);

  await expect(client.rename({ name: "Invoices" })).resolves.toBe("Invoices");
  expect(handled).toEqual(["Invoices"]);
});

test("refuses a call whose input breaks its schema before the handler runs", async () => {
  const handled: string[] = [];
  const client = connect(handled);

  const refusal = client.rename({ name: 42 } as never);

  await expect(refusal).rejects.toBeInstanceOf(ORPCError);
  await expect(refusal).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(handled).toEqual([]);
});
