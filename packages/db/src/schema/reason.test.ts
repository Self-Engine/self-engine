import { expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { defineReason, matchReason, refusal, type Reason } from "@self-engine/db/schema";

const referenced = defineReason("referenced", z.object({ table: z.string(), count: z.number() }));
const pinned = defineReason("pinned", z.object({ title: z.string() }));
const row = "01a1c0a2-f079-7000-8000-000000000000";

test("a Refusal carries a list of Reasons, each with code, severity, row, field and details", () => {
  const data = refusal.REFUSED.data;
  const reason = {
    code: "referenced",
    severity: "blocking",
    row,
    field: "project_id",
    details: { table: "time_entries", count: 12 },
  };
  expect(data.parse({ reasons: [reason] })).toEqual({ reasons: [reason] });
  expect(data.safeParse({ reasons: [] }).success).toBe(false);
  expect(data.safeParse({ reasons: [{ ...reason, severity: "fatal" }] }).success).toBe(false);
});

test("a Reason's definition gives its details typed when the code and the details match", () => {
  const reason: Reason = {
    code: "referenced",
    severity: "blocking",
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
