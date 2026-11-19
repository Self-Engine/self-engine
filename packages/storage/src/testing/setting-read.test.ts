// The read of a Setting through the context (D352), on the `workday` test module: the frame
// answers with the stored Setting, and the contract kit holds a Query to its declared reads.

import { call } from "@orpc/server";
import type { Database } from "@self-engine/db";
import { createSettingRows } from "@self-engine/settings-rows/testing";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { workdayHours } from "../../test/workday-module/contracts/index.ts";
import { workday } from "../../test/workday-module/data/index.ts";
import { defineSetting } from "@self-engine/settings";
import { z } from "zod";
import { createContext, createFrame } from "../core/index.ts";
import { checkContract } from "./contract.ts";
import { createTestContext, createTestDatabase } from "./helpers.ts";

let database: Database;
let frame: ReturnType<typeof createFrame<typeof workday.contract, typeof workday.rowMap>>;

beforeEach(async () => {
  database = await createTestDatabase(workday);
  frame = createFrame(workday, { database, sources: createTestContext(), checkOutputs: true });
});

afterEach(async () => {
  await database.close();
});

test("a Query answers with the stored Setting, typed by its declaration", async () => {
  await createSettingRows(database.kysely, [{ key: workdayHours.key, value: 6 }]);
  const hours: number = await call(frame.hours, undefined);
  expect(hours).toBe(6);
});

test("a Query answers with the declared default when the row is missing", async () => {
  await expect(call(frame.hours, undefined)).resolves.toBe(8);
});

test("the contract kit passes a Query that names the Settings table among its reads", async () => {
  await expect(checkContract(workday, () => {}, { hours: undefined })).resolves.toEqual([]);
});

test("the contract kit fails a Query that reads a Setting and does not name the table", async () => {
  const forgetful = { ...workday, entries: { hours: { ...workday.entries.hours, reads: [] } } };
  await expect(checkContract(forgetful, () => {}, { hours: undefined })).resolves.toEqual([
    { entry: "hours", rule: "query reads an undeclared table: settings" },
  ]);
});

test("reading a Device Setting through the context does not compile", async () => {
  const compact = defineSetting({
    key: "workday.compact",
    scope: "device",
    default: false,
    schema: z.boolean(),
  });
  const context = createContext(createTestContext());
  // @ts-expect-error A Device Setting stays on its device; the database holds none.
  await expect(context.readSetting(database.kysely, compact)).resolves.toBe(false);
});
