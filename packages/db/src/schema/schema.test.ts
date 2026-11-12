import { describe, expect, expectTypeOf, test } from "vite-plus/test";
import { z } from "zod";
import { idSchema, sqliteBoolean } from "@self-engine/db/schema";

const projectId = idSchema("Project");
const taskId = idSchema("Task");

describe("idSchema", () => {
  test("accepts UUIDv7 and rejects other versions and non-UUID text", () => {
    const value = "01a1c0a2-f079-7000-8000-000000000000";
    expect(projectId.parse(value)).toBe(value);
    for (const invalid of [
      "01a1c0a2-f079-4000-8000-000000000000",
      "01a1c0a2-f079-1000-8000-000000000000",
      "01a1c0a2-f079-7000-0000-000000000000",
      "not an id",
    ]) {
      expect(projectId.safeParse(invalid).success).toBe(false);
    }
  });

  test("gives each entity a distinct id type", () => {
    expectTypeOf<z.output<typeof projectId>>().toEqualTypeOf<string & z.$brand<"ProjectId">>();
    expectTypeOf<z.output<typeof projectId>>().not.toExtend<z.output<typeof taskId>>();
    expectTypeOf<z.output<typeof taskId>>().not.toExtend<z.output<typeof projectId>>();
  });
});

test("sqliteBoolean accepts only the two SQLite boolean values", () => {
  expect(sqliteBoolean.parse(0)).toBe(0);
  expect(sqliteBoolean.parse(1)).toBe(1);
  expectTypeOf<z.output<typeof sqliteBoolean>>().toEqualTypeOf<0 | 1>();
  for (const value of [true, false, "0", "1", 2, -1, 0.5, null, undefined]) {
    expect(sqliteBoolean.safeParse(value).success).toBe(false);
  }
});
