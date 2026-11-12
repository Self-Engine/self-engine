import { expect, expectTypeOf, test } from "vite-plus/test";
import { instantSchema, type Instant } from "./index.ts";

test("accepts a canonical UTC instant as a branded string", () => {
  const instant = instantSchema.parse("2026-11-09T14:07:46.297Z");
  expect(instant).toBe("2026-11-09T14:07:46.297Z");
  expectTypeOf(instant).toEqualTypeOf<Instant>();
  expectTypeOf<string>().not.toExtend<Instant>();
});

test.each([
  "2026-11-09T14:07:46Z",
  "2026-11-09T14:07:46.29Z",
  "2026-11-09T14:07:46.2970Z",
  "2026-11-09T14:07:46.297+00:00",
  "2026-11-09T21:07:46.297+07:00",
  "2026-11-09",
  "0999-12-31T23:59:59.999Z",
  "+010000-01-01T00:00:00.000Z",
  "2026-02-29T00:00:00.000Z",
  "2026-04-31T00:00:00.000Z",
  "2026-11-09T24:00:00.000Z",
  "2026-11-09T14:07:60.000Z",
])("rejects noncanonical or impossible instant %s", (value) => {
  expect(instantSchema.safeParse(value).success).toBe(false);
});

test.each([
  "1000-01-01T00:00:00.000Z",
  "9999-12-31T23:59:59.999Z",
  "2000-02-29T00:00:00.000Z",
])("accepts valid boundary and leap-day instant %s unchanged", (value) => {
  expect(instantSchema.parse(value)).toBe(value);
});
