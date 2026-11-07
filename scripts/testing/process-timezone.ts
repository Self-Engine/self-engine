/**
 * The process timezone of every test run (set in vite.config.ts): far from UTC, with a
 * non-whole-hour offset (UTC+12:45/+13:45) next to the date line, so code that leaks the
 * device timezone into a date fails here instead of passing on the developer's machine.
 */
export const TEST_TIME_ZONE = "Pacific/Chatham";

/** The zone the tests run in: `VITEST_TZ` reruns them elsewhere while hunting such a leak. */
export function testTimeZone(env: NodeJS.ProcessEnv = process.env): string {
  return env.VITEST_TZ || TEST_TIME_ZONE;
}
