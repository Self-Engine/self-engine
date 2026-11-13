import { type Clock } from "@self-engine/time";
import {
  advanceInstantByMilliseconds,
  fixedClock,
  requireInstant,
} from "@self-engine/time/testing";
import type { IdSources } from "../core/index.ts";

/** Shared deterministic sources for a test transaction context. */
export interface TestSources {
  readonly clock: Clock;
  readonly ids: IdSources;
  readonly advance: (ms: number) => void;
}

/** A fixed transaction time, moved only by `advance`. */
export function createTestSources(start: string): TestSources {
  let current = fixedClock(requireInstant(start));
  const clock: Clock = () => current();
  let counter = 0;
  const ids: IdSources = {
    clock,
    random: () => {
      if (counter >= 2 ** 48) throw new Error("Test id counter exhausted");
      let value = counter++;
      const bytes = new Uint8Array(16);
      // UUIDv7 preserves the final six random bytes. Big-endian order also sorts as text.
      for (let index = 15; index >= 10; index--) {
        bytes[index] = value % 256;
        value = Math.floor(value / 256);
      }
      return bytes;
    },
  };

  return {
    clock,
    ids,
    advance(ms: number): void {
      current = fixedClock(advanceInstantByMilliseconds(current(), ms));
    },
  };
}
