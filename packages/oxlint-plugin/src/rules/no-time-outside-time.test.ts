import { expect, test } from "vite-plus/test";
import { lintFixtures } from "../testing/lint-fixture.ts";

test("rejects every Date constructor overload", () => {
  const results = lintFixtures(
    "no-time-outside-time",
    ["new Date();", "new Date(ms);", "new Date(text);", "new Date(y, m, d);"],
    "packages/example/src",
  );
  expect(results.map((hits) => hits.length)).toEqual([1, 1, 1, 1]);
  expect(results.flat().every((hit) => hit.includes("instantAt"))).toBe(true);
});

test("rejects Date static methods, Temporal and date formatters, including saved references", () => {
  const results = lintFixtures(
    "no-time-outside-time",
    [
      "Date.now();",
      "Date.parse(text);",
      "Date.UTC(y, m, d);",
      "Temporal.Instant.from(text);",
      "new Intl.DateTimeFormat();",
      "date.toLocaleDateString();",
      "date.toLocaleTimeString();",
      'Date["now"]();',
      'Intl["DateTimeFormat"];',
      'date["toLocaleDateString"]();',
      "const now = Date.now;",
      "const { parse } = Date;",
      "const { DateTimeFormat } = Intl;",
      "const { toLocaleTimeString } = date;",
      "const temporal = Temporal;",
    ],
    "apps/desktop/src",
  );
  expect(results.map((hits) => hits.length)).toEqual(Array(15).fill(1));
  expect(results.flat().every((hit) => hit.includes("@self-engine/time"))).toBe(true);
});

test("allows unrelated clocks, number formatting and shadowed globals", () => {
  const sources = [
    "performance.now();",
    "new Intl.NumberFormat();",
    "(42).toLocaleString();",
    "const Temporal = { value: 1 }; Temporal.value;",
    "function f(Date: any) { return new Date(); }",
    "const object = { Temporal: 1 }; object.Temporal;",
  ];
  expect(lintFixtures("no-time-outside-time", sources, "packages/example/src")).toEqual(
    sources.map(() => []),
  );
});

test("allows all forbidden forms inside time and outside apps and packages", () => {
  const sources = [
    "new Date();",
    "new Date(ms);",
    "new Date(text);",
    "new Date(y, m, d);",
    "Date.now();",
    "Date.parse(text);",
    "Date.UTC(y, m, d);",
    "Temporal.Instant.from(text);",
    "new Intl.DateTimeFormat();",
    "date.toLocaleDateString();",
    "date.toLocaleTimeString();",
  ];
  for (const folder of ["packages/time/src", "scripts"]) {
    expect(lintFixtures("no-time-outside-time", sources, folder)).toEqual(sources.map(() => []));
  }
});

test("rejects direct date-library imports, subpaths, re-exports and dynamic loads", () => {
  const sources = [
    'import { addDays } from "date-fns";',
    'import dayjs from "dayjs";',
    'import { DateTime } from "luxon";',
    'import "date-fns/addDays";',
    'export { DateTime } from "luxon";',
    'export * from "dayjs";',
    'import("luxon");',
    'require("dayjs");',
  ];
  const results = lintFixtures("no-time-outside-time", sources, "packages/example/src");
  expect(results.map((hits) => hits.length)).toEqual(sources.map(() => 1));
  expect(results.flat().every((hit) => hit.includes("@self-engine/time"))).toBe(true);
});

test("allows Mantine imports and similarly named libraries", () => {
  const sources = ['import { DatePicker } from "@mantine/dates";', 'import "dayjs-other";'];
  expect(lintFixtures("no-time-outside-time", sources, "apps/desktop/src")).toEqual([[], []]);
});

test("rejects global-qualified APIs without confusing similarly named object properties", () => {
  const sources = [
    "new globalThis.Date(ms);",
    "globalThis.Date.now();",
    "globalThis.Temporal.Now.instant();",
    'globalThis["Intl"].DateTimeFormat;',
    "const { Temporal } = globalThis;",
  ];
  expect(
    lintFixtures("no-time-outside-time", sources, "packages/example/src").map(
      (hits) => hits.length,
    ),
  ).toEqual([1, 1, 1, 1, 1]);
});
