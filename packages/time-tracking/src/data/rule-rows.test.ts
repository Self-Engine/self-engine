// The lookup of a Rounding Rule walks the index of the Space's live rules, for a project and for an
// entry without one, and sorts the few rules it finds.
import { projectIdSchema } from "@self-engine/projects/ids";
import { projects } from "@self-engine/projects/data";
import { createContext } from "@self-engine/storage";
import { createTestContext, createTestDatabase, queryPlan } from "@self-engine/storage/testing";
import { instantSchema } from "@self-engine/time";
import { expect, test } from "vite-plus/test";
import { timeTracking } from "./index.ts";
import { ruleRows } from "./rounded-columns.ts";

test.each([
  ["a project", projectIdSchema.parse("01a1cfa1-0a00-7000-8000-000000000000")],
  ["no project", null],
])("the lookup for %s reads the rules by their index", async (_name, projectId) => {
  const database = await createTestDatabase(timeTracking, [projects]);
  try {
    const context = createContext(createTestContext());
    const startedAt = instantSchema.parse("2026-11-16T09:00:00.000Z");
    const plan = await queryPlan(
      database,
      ruleRows(database.kysely.withTables(), context, { projectId, startedAt }).compile(),
    );
    expect(plan.filter((line) => /^SCAN|AUTOMATIC/.test(line))).toEqual([]);
    expect(plan.some((line) => line.includes("rounding_rules_space"))).toBe(true);
  } finally {
    await database.close();
  }
});
