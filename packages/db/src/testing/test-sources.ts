import type { Clock, IdSources } from "../core/index.ts";

/** A fixed transaction time, moved only by `advance`. */
export function createTestSources(start: Date) {
  let milliseconds = start.getTime();
  const clock: Clock = () => new Date(milliseconds);
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
      milliseconds += ms;
    },
  };
}
