import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import { type AppContract, appContract } from "@self-engine/contracts";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { PROTOCOL_PROCEDURES } from "@self-engine/data-protocol";
import { afterEach, expect, expectTypeOf, test } from "vite-plus/test";
import { dataModules as modules } from "./data-modules.ts";

const started: TestDataProcess[] = [];
afterEach(async () => {
  for (const process of started.splice(0)) await process.close();
});

test("registered app module namespaces match the mounted app contract", () => {
  type Namespaces = Exclude<keyof AppContract, "health" | "tablesChanged">;
  expectTypeOf<keyof typeof modules>().toEqualTypeOf<Namespaces>();
  expect(Object.keys(modules).sort()).toEqual(
    Object.keys(appContract)
      .filter((key) => !(PROTOCOL_PROCEDURES as readonly string[]).includes(key))
      .sort(),
  );
});

test("placeholder-alpha is mounted: an Operation is followed by its Table Change and the list Query returns the new row", async () => {
  const process = await startTestDataProcess({ modules });
  started.push(process);
  const client = createORPCClient<ContractRouterClient<AppContract>>(
    new RPCLink({ port: process.openPort() }),
  );
  await expect(client.health()).resolves.toMatchObject({
    state: "ready",
    migrations: ["placeholder-alpha/0001"],
  });
  const events = await client.tablesChanged();
  await expect(events.next()).resolves.toEqual({
    done: false,
    value: {
      kind: "opened",
      queries: { placeholderAlpha: { list: ["placeholder_alpha_entries"] } },
    },
  });

  const created = await client.placeholderAlpha.create({ name: "Studio work" });

  await expect(events.next()).resolves.toEqual({
    done: false,
    value: { kind: "changed", tables: ["placeholder_alpha_entries"] },
  });
  await expect(client.placeholderAlpha.list({})).resolves.toEqual([
    { id: created.id, name: "Studio work" },
  ]);
  await expect(client.placeholderAlpha.create({ name: "Studio work" })).rejects.toMatchObject({
    code: "CONFLICT",
    data: { reason: "name_taken" },
  });
  await events.return();
});
