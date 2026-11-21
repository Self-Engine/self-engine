// SQLite uses the end bound of the Day Span window for filtered and unfiltered Queries.
import { projects } from "@self-engine/projects/data";
import { createContext } from "@self-engine/storage";
import { createTestContext, createTestDatabase, queryPlan } from "@self-engine/storage/testing";
import { instantSchema } from "@self-engine/time";
import { expect, test } from "vite-plus/test";
import { projectIdSchema } from "@self-engine/projects/contracts";
import { timeTracking } from "./index.ts";
import { windowRows } from "./days.ts";

const window = {
  start: instantSchema.parse("2026-11-15T23:00:00.000Z"),
  end: instantSchema.parse("2026-11-22T23:00:00.000Z"),
};
const projectId = projectIdSchema.parse("01a1cfa1-0b00-7000-8000-0000000000ff");

test("the window uses the end index with and without a filter", async () => {
  const database = await createTestDatabase(timeTracking, [projects]);
  try {
    const context = createContext(createTestContext());
    const tx = database.kysely.withTables();
    for (const filter of [
      undefined,
      { kind: "project", projectId } as const,
      { kind: "noProject" } as const,
    ]) {
      const plan = await queryPlan(database, windowRows(tx, context, window, filter).compile());
      const entries = plan.filter((line) => line.includes("time_entries"));
      expect(entries, JSON.stringify(filter)).toEqual([
        "SEARCH time_entries USING INDEX time_entries_ended (space_id=? AND ended_at>?)",
      ]);
    }
  } finally {
    await database.close();
  }
});
