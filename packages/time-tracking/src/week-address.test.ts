import { calendarDaySchema } from "@self-engine/time";
import { expect, test } from "vite-plus/test";
import { shownWeek, weekAfter, weekDayOf, withWeek } from "./week-address.ts";

const day = (text: string) => calendarDaySchema.parse(text);
const FRIDAY = day("2026-11-20");

test("without a day in the address the View shows the week of today, from the first day of the week", () => {
  expect(shownWeek(undefined, FRIDAY, "monday").span).toEqual({
    first: "2026-11-16",
    last: "2026-11-22",
  });
  // With another first day, the same day lies in another span.
  expect(shownWeek(undefined, FRIDAY, "saturday").span).toEqual({
    first: "2026-11-14",
    last: "2026-11-20",
  });
});

test("a day in the address shows its week, also when the week start changed since", () => {
  const search = { week: "2026-11-02", edit: "x" };
  expect(weekDayOf(search)).toBe("2026-11-02");
  expect(shownWeek(weekDayOf(search), FRIDAY, "sunday")).toEqual({
    span: { first: "2026-11-01", last: "2026-11-07" },
    todaysFirst: "2026-11-15",
  });
});

test("an invalid or unreachable day in the address shows the week of today", () => {
  for (const week of ["2026-02-30", "soon", 20_261_102, "1000-01-01"]) {
    expect(shownWeek(weekDayOf({ week }), FRIDAY, "monday").span.first).toBe("2026-11-16");
  }
});

test("the week of today leaves the address, every other week is written beside the other parameters", () => {
  const today = day("2026-11-16");
  expect(withWeek({ week: "2026-11-09", project: "none" }, today, today)).toEqual({
    project: "none",
  });
  expect(withWeek({ project: "none" }, day("2026-11-09"), today)).toEqual({
    project: "none",
    week: "2026-11-09",
  });
});

test("the week before and after move by seven days and stop at the supported years", () => {
  expect(weekAfter(day("2026-11-16"), -1)).toBe("2026-11-09");
  expect(weekAfter(day("2026-11-16"), 1)).toBe("2026-11-23");
  expect(weekAfter(day("9999-12-27"), 1)).toBeUndefined();
});
