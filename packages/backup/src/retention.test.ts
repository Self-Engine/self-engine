import { expect, test } from "vite-plus/test";
import { expiredBackups, isDailyBackupDue } from "./retention.ts";

/** A Backup at noon UTC on a day of November 2026; day 0 is the 31st of October. */
const on = (day: number, time = "12:00:00.000") => ({
  takenAt: `${new Date(Date.UTC(2026, 10, day)).toISOString().slice(0, 10)}T${time}Z`,
});
const days = (backups: readonly { takenAt: string }[]) =>
  backups.map(({ takenAt }) => takenAt.slice(0, 10));

/** One Backup a day from the 1st of October to the 30th of November 2026, a Monday. */
const TWO_MONTHS = Array.from({ length: 61 }, (_, index) => on(index - 30));

test("of one Backup a day, the newest seven days and the four weeks before them are kept", () => {
  const expired = new Set(expiredBackups(TWO_MONTHS));
  const kept = TWO_MONTHS.filter((backup) => !expired.has(backup));

  expect(days(kept)).toEqual([
    // The newest Backup of each of the four weeks before the seven days: three Sundays, and the
    // Monday that the seven days left of their own week.
    "2026-11-08",
    "2026-11-15",
    "2026-11-22",
    "2026-11-23",
    // Seven days, Tuesday to Monday.
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
    "2026-11-27",
    "2026-11-28",
    "2026-11-29",
    "2026-11-30",
  ]);
});

test("up to seven days of Backups, nothing expires", () => {
  expect(expiredBackups(TWO_MONTHS.slice(-7))).toEqual([]);
  expect(expiredBackups([])).toEqual([]);
});

test("every Backup of a kept day stays, so one taken by hand outlives the daily one beside it", () => {
  const backups = [on(30, "06:00:00.000"), on(30, "09:30:00.000"), on(30, "18:45:00.000")];

  expect(expiredBackups(backups)).toEqual([]);
});

test("of a week before the kept days only its newest Backup stays", () => {
  const kept = Array.from({ length: 7 }, (_, index) => on(24 + index));
  const monday = on(16, "08:00:00.000");
  const wednesdayMorning = on(18, "08:00:00.000");
  const wednesdayEvening = on(18, "20:00:00.000");

  expect(expiredBackups([...kept, monday, wednesdayMorning, wednesdayEvening])).toEqual([
    wednesdayMorning,
    monday,
  ]);
});

test("the days count Backups, not the calendar: after months without a start nothing is lost", () => {
  // Used daily in the first week of November, then not until the 30th.
  const backups = [...Array.from({ length: 7 }, (_, index) => on(index + 1)), on(30)];

  // Seven days with a Backup are kept, so only the oldest of the eight leaves the daily Backups,
  // and it stays as the newest of its week: the 1st is a Sunday.
  expect(expiredBackups(backups)).toEqual([]);
});

test("the order in which the Backups are listed does not matter", () => {
  const shuffled = [...TWO_MONTHS.slice(30), ...TWO_MONTHS.slice(0, 30)].toReversed();

  expect(days(expiredBackups(shuffled)).toSorted()).toEqual(
    days(expiredBackups(TWO_MONTHS)).toSorted(),
  );
});

test("the numbers of days and weeks can be set", () => {
  const expired = expiredBackups(TWO_MONTHS, { days: 2, weeks: 1 });

  expect(days(TWO_MONTHS.filter((backup) => !expired.includes(backup)))).toEqual([
    "2026-11-28",
    "2026-11-29",
    "2026-11-30",
  ]);
});

test("the daily Backup is due when no Backup was taken on this UTC day", () => {
  const yesterdayLate = [{ takenAt: "2026-11-12T23:59:59.999Z" }];

  expect(isDailyBackupDue(yesterdayLate, new Date("2026-11-13T00:00:00.000Z"))).toBe(true);
  expect(isDailyBackupDue([], new Date("2026-11-13T00:00:00.000Z"))).toBe(true);
});

test("the daily Backup is not due after any Backup of this UTC day", () => {
  const thisMorning = [{ takenAt: "2026-11-13T00:00:00.000Z" }];

  expect(isDailyBackupDue(thisMorning, new Date("2026-11-13T23:59:59.999Z"))).toBe(false);
});
