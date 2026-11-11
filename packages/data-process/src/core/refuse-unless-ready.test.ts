// In a failure state the data process answers only `health`. The app contract has no second
// procedure yet, so a fixture contract with one proves the refusal, over Node's MessageChannel.

import { MessageChannel } from "node:worker_threads";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { type ContractRouterClient, oc } from "@orpc/contract";
import { implement } from "@orpc/server";
import { type Health, healthContract } from "@self-engine/contracts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import { refuseUnlessReady } from "./refuse-unless-ready.ts";
import { createPortServer } from "./serve.ts";

const fixtureContract = {
  health: healthContract,
  rename: oc.input(z.object({ name: z.string() })).output(z.string()),
};

const ports: MessageChannel[] = [];

afterEach(() => {
  for (const { port1, port2 } of ports.splice(0)) {
    port1.close();
    port2.close();
  }
});

function connect(health: Health, handled: string[]): ContractRouterClient<typeof fixtureContract> {
  const implementer = implement(fixtureContract);
  const serve = createPortServer(
    refuseUnlessReady(health, {
      health: implementer.health.handler(() => health),
      rename: implementer.rename.handler(({ input }) => {
        handled.push(input.name);
        return input.name;
      }),
    }),
  );
  const channel = new MessageChannel();
  ports.push(channel);
  serve(channel.port1);
  channel.port2.start();
  return createORPCClient(new RPCLink({ port: channel.port2 }));
}

describe.each<Health>([
  { state: "migrationFailed", migration: "time/0002" },
  { state: "databaseNewer", migration: "time/0002" },
])("in the state $state", (health) => {
  test("answers health", async () => {
    const client = connect(health, []);

    await expect(client.health()).resolves.toEqual(health);
  });

  test("refuses every other procedure before its handler runs, saying why", async () => {
    const handled: string[] = [];
    const client = connect(health, handled);

    const refusal = client.rename({ name: "Invoices" });

    await expect(refusal).rejects.toBeInstanceOf(ORPCError);
    await expect(refusal).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", data: health });
    expect(handled).toEqual([]);
  });
});

test("when ready, answers every procedure", async () => {
  const handled: string[] = [];
  const client = connect({ state: "ready", sqliteVersion: "3.50.0", migrations: [] }, handled);

  await expect(client.rename({ name: "Invoices" })).resolves.toBe("Invoices");
  expect(handled).toEqual(["Invoices"]);
});
