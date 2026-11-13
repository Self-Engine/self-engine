import { expect, test } from "vite-plus/test";
import { DAILY_CHECK_INTERVAL_MS, keepDailyBackups } from "./daily.ts";

/** A timer the test fires by hand: no real clock runs. */
function manualTimer() {
  const intervals: { callback: () => void; milliseconds: number }[] = [];
  return {
    intervals,
    setInterval(callback: () => void, milliseconds: number) {
      intervals.push({ callback, milliseconds });
      return intervals.length;
    },
  };
}

test("asks at once whether the daily Backup is due, and again every hour", () => {
  const timer = manualTimer();
  let asked = 0;
  const backups = {
    backUpIfDue: () => {
      asked += 1;
      return Promise.resolve(undefined);
    },
  };

  keepDailyBackups(backups, { timer, onError: () => undefined });
  expect(asked).toBe(1);
  expect(timer.intervals.map(({ milliseconds }) => milliseconds)).toEqual([
    DAILY_CHECK_INTERVAL_MS,
  ]);
  expect(DAILY_CHECK_INTERVAL_MS).toBe(3_600_000);

  timer.intervals[0]?.callback();
  timer.intervals[0]?.callback();
  expect(asked).toBe(3);
});

test("a daily Backup that fails is reported, and the next hour asks again", async () => {
  const timer = manualTimer();
  const errors: unknown[] = [];
  let asked = 0;
  const full = new Error("The disk is full");
  const backups = {
    backUpIfDue: () => {
      asked += 1;
      return Promise.reject(full);
    },
  };

  keepDailyBackups(backups, { timer, onError: (error) => errors.push(error) });
  await Promise.resolve();
  await Promise.resolve();
  expect(errors).toEqual([full]);

  timer.intervals[0]?.callback();
  expect(asked).toBe(2);
});
