import { expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import {
  defineReason,
  findReason,
  matchReason,
  refusal,
  type Reason,
} from "@self-engine/db/schema";

const referenced = defineReason("referenced", z.object({ table: z.string(), count: z.number() }));
const pinned = defineReason("pinned", z.object({ title: z.string() }));
const row = "01a1c0a2-f079-7000-8000-000000000000";

test("a Refusal carries a list of Reasons, each with code, severity, table, row, field and details", () => {
  const data = refusal.REFUSED.data;
  const reason = {
    code: "referenced",
    severity: "blocking",
    table: "projects",
    row,
    field: "project_id",
    details: { table: "time_entries", count: 12 },
  };
  expect(data.parse({ reasons: [reason] })).toEqual({ reasons: [reason] });
  expect(data.safeParse({ reasons: [] }).success).toBe(false);
  expect(data.safeParse({ reasons: [{ ...reason, severity: "fatal" }] }).success).toBe(false);
  const { table: _table, ...withoutTable } = reason;
  expect(data.safeParse({ reasons: [withoutTable] }).success).toBe(false);
});

test("a Reason's definition gives its details typed when the code and the details match", () => {
  const reason: Reason = {
    code: "referenced",
    severity: "blocking",
    table: "projects",
    row,
    details: { table: "time_entries", count: 12 },
  };
  const match = matchReason(referenced, reason);
  expect(match).toEqual(reason);
  expectTypeOf(match).toEqualTypeOf<
    Reason<"referenced", { table: string; count: number }> | undefined
  >();
  expect(matchReason(pinned, reason)).toBeUndefined();
  expect(matchReason(referenced, { ...reason, details: { table: "time_entries" } })).toBe(
    undefined,
  );
});

test("a Reason's details cannot transform their input: they are parsed where a rule answers and again where a caller matches", () => {
  const counted = z.string().transform((text) => text.length);
  // @ts-expect-error A transform would run twice.
  defineReason("counted", counted);
  const defaulted = z.object({ title: z.string().default("Untitled") });
  // @ts-expect-error A default fills in where the input left a gap.
  defineReason("titled", defaulted);
  expectTypeOf(
    defineReason("titled", z.object({ title: z.string().optional() })).code,
  ).toEqualTypeOf<"titled">();
});

test("a Refusal answers the first Reason that is the defined one, with its details typed", () => {
  const reason = (code: string, details: unknown): Reason => ({
    code,
    severity: "blocking",
    table: "projects",
    row,
    details,
  });
  const refused = {
    reasons: [
      reason("pinned", { title: "Website" }),
      reason("referenced", { table: "tasks" }),
      reason("referenced", { table: "time_entries", count: 12 }),
    ],
  };

  const found = findReason(refused, referenced);

  // The first `referenced` has details of another shape, so the second one answers.
  expect(found).toEqual(refused.reasons[2]);
  expectTypeOf(found).toEqualTypeOf<
    Reason<"referenced", { table: string; count: number }> | undefined
  >();
  // @ts-expect-error The details of `referenced` have no `amount`.
  void found?.details.amount;
  expect(findReason({ reasons: [refused.reasons[0]!] }, referenced)).toBeUndefined();
});
