import { call, ORPCError } from "@orpc/server";
import type { Database } from "@self-engine/db";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { memoIdSchema } from "../../test/memos-module/contracts/index.ts";
import { memos } from "../../test/memos-module/data/index.ts";
import { memosMigrations, memosRowMap } from "../../test/memos-module/data/rows.ts";
import { createFrame } from "../core/index.ts";
import { createTestContext, createTestDatabase } from "./helpers.ts";

let database: Database;
let sources: ReturnType<typeof createTestContext>;
let announced: string[][];
let frame: ReturnType<typeof createFrame<typeof memos.contract, typeof memos.rowMap>>;

beforeEach(async () => {
  database = await createTestDatabase(memos);
  sources = createTestContext();
  announced = [];
  frame = createFrame(memos, {
    database,
    sources,
    checkOutputs: true,
    announce: (tables) => {
      announced.push([...tables]);
    },
  });
});

afterEach(async () => {
  await database.close();
});

async function stored() {
  const created = await call(frame.create, { title: "Plan", body: "Steps", color: "red" });
  sources.advance(60_000);
  announced = [];
  return created;
}

test("the memos module follows conventions and its row map agrees with its migrations", async () => {
  await expect(checkConventions(database)).resolves.toEqual([]);
  await expect(checkAgreement(memosMigrations, memosRowMap)).resolves.toEqual([]);
});

describe("an edit (D329)", () => {
  test("leaves a missing field untouched and sets the one it carries", async () => {
    const memo = await stored();
    await expect(call(frame.edit, { id: memo.id, title: "Plan B" })).resolves.toEqual({
      ...memo,
      title: "Plan B",
      updatedAt: "2026-11-12T12:01:00.000Z",
    });
    expect(announced).toEqual([["memos"]]);
  });

  test("clears an optional field sent as null", async () => {
    const memo = await stored();
    await expect(call(frame.edit, { id: memo.id, body: null, color: null })).resolves.toEqual({
      ...memo,
      body: null,
      color: null,
      updatedAt: "2026-11-12T12:01:00.000Z",
    });
  });

  test("rejects null for a required field and an unknown field as input errors", async () => {
    const memo = await stored();
    for (const input of [
      { id: memo.id, title: null },
      { id: memo.id, titel: "Typo" },
    ]) {
      await expect(call(frame.edit, input as never)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    await expect(call(frame.list, {})).resolves.toEqual([memo]);
  });

  test("without fields answers with the entry, writes nothing and sends no Table Change", async () => {
    const memo = await stored();
    await expect(call(frame.edit, { id: memo.id })).resolves.toEqual(memo);
    expect(announced).toEqual([]);
    await expect(call(frame.list, {})).resolves.toEqual([memo]);
  });

  test("without fields is still not found for an unknown or deleted id", async () => {
    const memo = await stored();
    const unknown = memoIdSchema.parse("01a1cfa1-0a00-7fff-bfff-ffffffffffff");
    await expect(call(frame.edit, { id: unknown })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await call(frame.delete, { id: memo.id });
    await expect(call(frame.edit, { id: memo.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("sends a rule's reason to the caller when the tied fields travel together", async () => {
    const memo = await stored();
    await expect(call(frame.edit, { id: memo.id, title: "Steps" })).resolves.toMatchObject({
      title: "Steps",
    });
    const error: unknown = await call(frame.edit, {
      id: memo.id,
      title: "Same",
      body: "Same",
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: [
          expect.objectContaining({ path: ["body"], params: { reason: "body_matches_title" } }),
        ],
      },
    });
  });

  test("writes a value already stored: the Operation does not compare with the stored state", async () => {
    const memo = await stored();
    await expect(call(frame.edit, { id: memo.id, title: memo.title })).resolves.toEqual({
      ...memo,
      updatedAt: "2026-11-12T12:01:00.000Z",
    });
    expect(announced).toEqual([["memos"]]);
  });
});

test("a create may omit an optional field, which then counts as empty", async () => {
  await expect(call(frame.create, { title: "Plan" })).resolves.toMatchObject({
    title: "Plan",
    body: null,
    color: null,
  });
  await expect(call(frame.create, { title: "Plan", colour: "red" } as never)).rejects.toMatchObject(
    { code: "BAD_REQUEST" },
  );
});
