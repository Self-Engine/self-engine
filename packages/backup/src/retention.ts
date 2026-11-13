// Which Backups are kept (D94): seven daily and four weekly. Days and weeks are counted in UTC, so
// the rule needs no time zone and gives the same answer on every device. It never asks what time
// it is: only the Backups that exist decide, so a device that was off for months loses none.

/** What the rule needs of a Backup: when it was taken, as a UTC instant. */
interface Dated {
  readonly takenAt: string;
}

export interface RetentionPolicy {
  /** The newest days with a Backup of which every Backup is kept. */
  readonly days: number;
  /** The newest weeks before those days of which the newest Backup is kept. */
  readonly weeks: number;
}

export const RETENTION: RetentionPolicy = { days: 7, weeks: 4 };

const DAY_MS = 86_400_000;

/** The UTC day of an instant, counted from 1970-01-01. */
function dayOf(instant: string | Date): number {
  const milliseconds = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  return Math.floor(milliseconds / DAY_MS);
}

/** The week of a day, Monday to Sunday: 1970-01-01 was a Thursday. */
function weekOf(day: number): number {
  return Math.floor((day + 3) / 7);
}

/**
 * The Backups to delete. Kept are every Backup of the newest `days` days that have one, and
 * before those the newest Backup of each of the newest `weeks` weeks that have one. With one
 * automatic Backup a day that is seven daily and four weekly Backups; a Backup taken by hand or
 * before a migration or a restore stays at least as long as the daily one of its day.
 */
export function expiredBackups<Backup extends Dated>(
  backups: readonly Backup[],
  { days, weeks }: RetentionPolicy = RETENTION,
): Backup[] {
  const newestFirst = backups.toSorted((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
  const keptDays = new Set<number>();
  for (const backup of newestFirst) {
    if (keptDays.size < days) keptDays.add(dayOf(backup.takenAt));
  }
  const keptWeeks = new Set<number>();
  const expired: Backup[] = [];
  for (const backup of newestFirst) {
    const day = dayOf(backup.takenAt);
    if (keptDays.has(day)) continue;
    const week = weekOf(day);
    // The first Backup met in a week is its newest.
    if (!keptWeeks.has(week) && keptWeeks.size < weeks) keptWeeks.add(week);
    else expired.push(backup);
  }
  return expired;
}

/** Whether no Backup was taken on the UTC day of `now` yet: the daily one is due. */
export function isDailyBackupDue(backups: readonly Dated[], now: Date): boolean {
  const today = dayOf(now);
  return !backups.some((backup) => dayOf(backup.takenAt) === today);
}
