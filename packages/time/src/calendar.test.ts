import { expect, test } from "vite-plus/test";
import { addDays, addMonths, daysBetween, weekOf, isoWeekNumber, calendarDaySchema } from "./index.ts";
const day = (value: string) => calendarDaySchema.parse(value);

test.each([
  ["2026-01-30", 3, "2026-02-02"], ["2026-03-01", -1, "2026-02-28"],
  ["2025-12-31", 1, "2026-01-01"], ["2026-01-01", -1, "2025-12-31"],
  ["2024-02-28", 1, "2024-02-29"], ["2026-03-28", 1, "2026-03-29"],
  ["2026-10-25", 1, "2026-10-26"], ["1000-01-01", 0, "1000-01-01"],
] as const)("%s plus %s days is %s", (from, amount, expected) => {
  expect(addDays(day(from), amount)).toBe(expected);
});
test.each([0.5, -0.5, NaN, Infinity])("rejects non-whole day count %s", (amount) => {
  expect(() => addDays(day("2026-01-01"), amount)).toThrow(RangeError);
});
test.each([["1000-01-01", -1], ["9999-12-31", 1]] as const)("rejects day arithmetic outside the year range %s", (from, amount) => {
  expect(() => addDays(day(from), amount)).toThrow();
});

test.each([
  ["2026-01-31", 1, "2026-02-28"], ["2024-01-31", 1, "2024-02-29"],
  ["2026-03-31", -1, "2026-02-28"], ["2026-03-15", -3, "2025-12-15"],
  ["2026-12-01", 13, "2028-01-01"], ["2024-02-29", 0, "2024-02-29"],
] as const)("%s plus %s months is %s", (from, amount, expected) => {
  expect(addMonths(day(from), amount)).toBe(expected);
});
test.each([0.5, -0.5, NaN, Infinity])("rejects non-whole month count %s", (amount) => {
  expect(() => addMonths(day("2026-01-01"), amount)).toThrow(RangeError);
});
test.each([["1000-01-01", -1], ["9999-12-31", 1]] as const)("rejects month arithmetic outside the year range %s", (from, amount) => {
  expect(() => addMonths(day(from), amount)).toThrow();
});
test.each([
 ["2026-12-30", "2027-01-02", 3], ["2026-03-05", "2026-02-26", -7],
 ["2024-02-28", "2024-03-01", 2], ["2026-03-05", "2026-03-05", 0],
 ["1000-01-01", "9999-12-31", 3287181],
] as const)("counts calendar days from %s to %s", (from, to, expected) => {
 expect(daysBetween(day(from), day(to))).toBe(expected);
});
test.each([
 [1, "2026-05-11", "2026-05-17"], [0, "2026-05-10", "2026-05-16"],
 [6, "2026-05-09", "2026-05-15"], [3, "2026-05-13", "2026-05-19"],
 [4, "2026-05-07", "2026-05-13"],
] as const)("week starting on %s has inclusive limits", (firstDayOfWeek, first, last) => {
 expect(weekOf(day("2026-05-13"), firstDayOfWeek)).toEqual({ first, last });
});
test("weeks cross year boundaries", () => {
 expect(weekOf(day("2027-01-01"), 1)).toEqual({ first: "2026-12-28", last: "2027-01-03" });
});
test.each([[["1000-01-01", 0]], [["9999-12-31", 1]]] as const)("rejects weeks whose span exceeds the supported years %j", (cases) => {
 const [from, firstDayOfWeek] = cases[0];
 expect(() => weekOf(day(from), firstDayOfWeek)).toThrow();
});
test.each([["2026-10-05", 41], ["2026-10-11", 41], ["2027-01-01", 53], ["2027-01-04", 1], ["2025-12-29", 1], ["1000-01-01", 1], ["9999-12-31", 52]] as const)("ISO week of %s is %s", (from, expected) => {
 expect(isoWeekNumber(day(from))).toBe(expected);
});
