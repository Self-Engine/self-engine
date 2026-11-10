// For Stories only, here and in the app. A subpath of its own, so that `storybook` stays out of
// what the package's main entry ships.

import { spyOn } from "storybook/test";

/**
 * Holds every timer of exactly `delay` ms, for the story to run by hand or leave alone. Other
 * timers stay real: the queries poll with them. `restore` belongs in the story's cleanup.
 */
export function holdTimers(delay: number) {
  const held = new Map<number, () => void>();
  let nextId = -1000;
  const realSet = window.setTimeout.bind(window);
  const realClear = window.clearTimeout.bind(window);
  const set = spyOn(window, "setTimeout").mockImplementation(((run: () => void, ms?: number) => {
    if (ms !== delay) return realSet(run, ms);
    nextId -= 1;
    held.set(nextId, run);
    return nextId;
  }) as typeof window.setTimeout);
  const clear = spyOn(window, "clearTimeout").mockImplementation(((id?: number) => {
    if (id !== undefined && held.delete(id)) return;
    realClear(id);
  }) as typeof window.clearTimeout);
  return {
    held,
    restore: () => {
      set.mockRestore();
      clear.mockRestore();
    },
  };
}
