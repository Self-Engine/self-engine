import { expect, expectTypeOf, test } from "vite-plus/test";
import { firstDayOfWeekSchema } from "./first-day-of-week.ts";
import type { FirstDayOfWeek } from "./index.ts";

test.each(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])(
  "accepts %s as a named first day",
  (name) => {
    const parsed = firstDayOfWeekSchema.parse(name);
    expectTypeOf(parsed).toEqualTypeOf<FirstDayOfWeek>();
    expect(parsed).toBe(name);
  },
);

test.each([0, 7, "automatic", "Monday", "funday"])("rejects %j as a named first day", (value) => {
  expect(firstDayOfWeekSchema.safeParse(value).success).toBe(false);
});
