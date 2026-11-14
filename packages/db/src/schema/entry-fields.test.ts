import { describe, expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { entryFields, idSchema } from "@self-engine/db/schema";

const cardId = idSchema("Card");
const id = cardId.parse("01a1c0a2-f079-7000-8000-000000000000");
const card = entryFields(cardId, {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(10_000).nullable(),
  color: z.enum(["red", "blue"]).nullable(),
});

describe("the create input", () => {
  test("requires a required field and lets an optional one be missing", () => {
    expect(card.create.parse({ title: " Plan " })).toEqual({ title: "Plan" });
    expect(card.create.parse({ title: "Plan", body: null, color: "red" })).toEqual({
      title: "Plan",
      body: null,
      color: "red",
    });
    expect(card.create.safeParse({ body: "Text" }).success).toBe(false);
    expect(card.create.safeParse({ title: null }).success).toBe(false);
  });

  test("rejects an unknown field", () => {
    expect(card.create.safeParse({ title: "Plan", titel: "Typo" }).success).toBe(false);
  });

  test("infers a missing optional field and a required one", () => {
    expectTypeOf<z.output<typeof card.create>>().toEqualTypeOf<{
      title: string;
      body?: string | null | undefined;
      color?: "red" | "blue" | null | undefined;
    }>();
  });
});

describe("the edit input", () => {
  test("requires the id and lets every field be missing", () => {
    expect(card.edit.parse({ id })).toEqual({ id });
    expect(card.edit.parse({ id, body: "Text" })).toEqual({ id, body: "Text" });
    expect(card.edit.safeParse({ title: "Plan" }).success).toBe(false);
  });

  test("accepts null for an optional field and never for a required one", () => {
    expect(card.edit.parse({ id, body: null, color: null })).toEqual({
      id,
      body: null,
      color: null,
    });
    expect(card.edit.safeParse({ id, title: null }).success).toBe(false);
  });

  test("checks a value it carries with the field's own rules", () => {
    expect(card.edit.parse({ id, title: " Plan " })).toEqual({ id, title: "Plan" });
    expect(card.edit.safeParse({ id, title: " " }).success).toBe(false);
    expect(card.edit.safeParse({ id, color: "green" }).success).toBe(false);
  });

  test("rejects an unknown field", () => {
    expect(card.edit.safeParse({ id, titel: "Typo" }).success).toBe(false);
  });

  test("infers the branded id and every field as optional", () => {
    expectTypeOf<z.output<typeof card.edit>>().toEqualTypeOf<{
      id: z.output<typeof cardId>;
      title?: string | undefined;
      body?: string | null | undefined;
      color?: "red" | "blue" | null | undefined;
    }>();
  });

  test("carries a rule across two fields, checked when both travel, with its reason", () => {
    const tied = card.edit.refine(
      ({ title, body }) => title === undefined || body === undefined || body !== title,
      { path: ["body"], params: { reason: "body_matches_title" } },
    );
    expect(tied.safeParse({ id, title: "Same" }).success).toBe(true);
    const result = tied.safeParse({ id, title: "Same", body: "Same" });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["body"], params: { reason: "body_matches_title" } }),
    ]);
    expect(tied.safeParse({ id, title: "Same", extra: 1 }).success).toBe(false);
  });
});

test("keeps the field list for a module's own use", () => {
  expect(Object.keys(card.fields)).toEqual(["title", "body", "color"]);
});
