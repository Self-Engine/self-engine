import { call, ORPCError } from "@orpc/server";
import type { Database } from "@self-engine/db";
import { checkAgreement, checkConventions } from "@self-engine/db/testing";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { cardIdSchema } from "../../test/cards-module/contracts/index.ts";
import { cards } from "../../test/cards-module/data/index.ts";
import { cardsMigrations, cardsRowMap } from "../../test/cards-module/data/rows.ts";
import { createFrame } from "../core/index.ts";
import { createTestContext, createTestDatabase } from "./helpers.ts";

let database: Database;
let sources: ReturnType<typeof createTestContext>;
let announced: string[][];
let frame: ReturnType<typeof createFrame<typeof cards.contract, typeof cards.rowMap>>;

beforeEach(async () => {
  database = await createTestDatabase(cards);
  sources = createTestContext();
  announced = [];
  frame = createFrame(cards, {
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

test("the cards module follows conventions and its row map agrees with its migrations", async () => {
  await expect(checkConventions(database)).resolves.toEqual([]);
  await expect(checkAgreement(cardsMigrations, cardsRowMap)).resolves.toEqual([]);
});

describe("an edit (D329)", () => {
  test("leaves a missing field untouched and sets the one it carries", async () => {
    const card = await stored();
    await expect(call(frame.edit, { id: card.id, title: "Plan B" })).resolves.toEqual({
      ...card,
      title: "Plan B",
      updatedAt: "2026-11-12T12:01:00.000Z",
    });
    expect(announced).toEqual([["cards"]]);
  });

  test("clears an optional field sent as null", async () => {
    const card = await stored();
    await expect(call(frame.edit, { id: card.id, body: null, color: null })).resolves.toEqual({
      ...card,
      body: null,
      color: null,
      updatedAt: "2026-11-12T12:01:00.000Z",
    });
  });

  test("rejects null for a required field and an unknown field as input errors", async () => {
    const card = await stored();
    for (const input of [
      { id: card.id, title: null },
      { id: card.id, titel: "Typo" },
    ]) {
      await expect(call(frame.edit, input as never)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    await expect(call(frame.list, {})).resolves.toEqual([card]);
  });

  test("without fields answers with the entry, writes nothing and sends no Table Change", async () => {
    const card = await stored();
    await expect(call(frame.edit, { id: card.id })).resolves.toEqual(card);
    expect(announced).toEqual([]);
    await expect(call(frame.list, {})).resolves.toEqual([card]);
  });

  test("without fields is still not found for an unknown or deleted id", async () => {
    const card = await stored();
    const unknown = cardIdSchema.parse("01a1cfa1-0a00-7fff-bfff-ffffffffffff");
    await expect(call(frame.edit, { id: unknown })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await call(frame.delete, { id: card.id });
    await expect(call(frame.edit, { id: card.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("sends a rule's reason to the caller when the tied fields travel together", async () => {
    const card = await stored();
    await expect(call(frame.edit, { id: card.id, title: "Steps" })).resolves.toMatchObject({
      title: "Steps",
    });
    const error: unknown = await call(frame.edit, {
      id: card.id,
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
    const card = await stored();
    await expect(call(frame.edit, { id: card.id, title: card.title })).resolves.toEqual({
      ...card,
      updatedAt: "2026-11-12T12:01:00.000Z",
    });
    expect(announced).toEqual([["cards"]]);
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
