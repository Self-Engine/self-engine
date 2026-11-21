import { queryPlan } from "@self-engine/storage/testing";
import { expect, test } from "vite-plus/test";
import {
  INDEXES,
  measureTimeTracking,
  setWindowIndexes,
  SPANS,
  withTimeTrackingFixture,
} from "./measure-time-tracking.ts";

test("the benchmark runs the same Time Entry window under all three index setups", async () => {
  await withTimeTrackingFixture(async ({ database, client, windowStatement }) => {
    const span = SPANS.old;
    const answer = await client.days({ span });
    expect(answer.days.some((day) => day.entries.length > 0)).toBe(true);
    for (const variant of ["both", "start", "end"] as const) {
      await setWindowIndexes(database, variant);
      expect(await client.days({ span })).toEqual(answer);
      const statement = await windowStatement(span);
      expect(await database.kysely.executeQuery(statement)).toMatchObject({
        rows: expect.arrayContaining([expect.objectContaining({ note: "Generated Time Entry" })]),
      });
      const plan = await queryPlan(database, statement);
      expect(plan.some((detail) => INDEXES[variant].some((name) => detail.includes(name)))).toBe(
        true,
      );
    }
  }, 33);
});

test.skipIf(process.env.MEASURE_TIME_TRACKING !== "1")(
  "measure timeTracking.days on two years of Time Entries",
  async () => {
    console.log(JSON.stringify(await measureTimeTracking(), null, 2));
  },
  60_000,
);
