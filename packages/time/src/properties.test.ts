import fc from "fast-check";
import { expect, test } from "vite-plus/test";
import { durationBetween, epochMsOf, instantSchema } from "./index.ts";

// All supported millisecond Instants, including dates before the Unix epoch.
const epochMs = fc.integer({ min: -30610224000000, max: 253402300799999 });
const instantAt = (milliseconds: number) =>
  instantSchema.parse(new Date(milliseconds).toISOString());
const parameters = { seed: 241104, numRuns: 1000 };

test("canonical Instants sorted as text are in chronological order", () => {
  fc.assert(
    fc.property(fc.array(epochMs, { minLength: 2, maxLength: 50 }), (values) => {
      const sortedInstants = values.map(instantAt).sort();
      expect(sortedInstants.map(epochMsOf)).toEqual([...values].sort((a, b) => a - b));
    }),
    parameters,
  );
});

test("adjoining entry durations sum to the whole without losing seconds", () => {
  fc.assert(
    fc.property(fc.array(epochMs, { minLength: 3, maxLength: 50 }), (values) => {
      const instants = values.sort((a, b) => a - b).map(instantAt);
      let total = 0;
      for (let i = 1; i < instants.length; i++) {
        total += durationBetween(instants[i - 1]!, instants[i]!);
      }
      expect(total).toBe(durationBetween(instants[0]!, instants.at(-1)!));
    }),
    parameters,
  );
});
