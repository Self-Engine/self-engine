import { type AppContract, appContract } from "@self-engine/contracts";
import { PROTOCOL_PROCEDURES } from "@self-engine/data-protocol";
import { expect, expectTypeOf, test } from "vite-plus/test";
import { dataModules as modules } from "./data-modules.ts";

test("registered app module namespaces match the mounted app contract", () => {
  type Namespaces = Exclude<keyof AppContract, "health" | "tablesChanged">;
  expectTypeOf<keyof typeof modules>().toEqualTypeOf<Namespaces>();
  expect(Object.keys(modules).sort()).toEqual(
    Object.keys(appContract)
      .filter((key) => !(PROTOCOL_PROCEDURES as readonly string[]).includes(key))
      .sort(),
  );
});
