import { calendarDaySchema, instantSchema } from "@self-engine/time";
import { expect, expectTypeOf, test } from "vite-plus/test";
import { checkedOrNull } from "./checked-value.ts";

test("a value the schema reads comes back with its brand; anything else is null", () => {
  const day = checkedOrNull(calendarDaySchema, "2026-11-05");
  expect(day).toBe("2026-11-05");
  expectTypeOf(day).toEqualTypeOf<ReturnType<typeof calendarDaySchema.parse> | null>();
  expect(checkedOrNull(calendarDaySchema, "5.11.2026")).toBeNull();
  expect(checkedOrNull(calendarDaySchema, null)).toBeNull();
  expect(checkedOrNull(instantSchema, "2026-11-05")).toBeNull();
});
