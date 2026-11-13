// Which Backups are kept (D94): seven daily and four weekly. Of each of the newest seven days
// that have a Backup, the newest Backup of each kind stays, so a day holds at most four: its
// daily one, the newest taken by hand, the newest from before a migration and the newest from
// before a restore. Before those days, the newest Backup of each of four weeks stays. Days and
// weeks are counted in UTC, not in the zone the user picked, so the rule gives the same answer
// on every device and after every change of zone. It never asks what time it is: only the Backups that exist decide, so a device that
// was off for months loses none.

import {
  type CalendarDay,
  calendarDayOf,
  type Instant,
  resolveTimeZone,
  weekOf,
} from "@self-engine/time";

/** What the rule needs of a Backup: the Instant it was taken. */
interface Dated {
  readonly takenAt: Instant;
}

/** A Backup with the reason it was taken, which the rule keeps apart within a day. */
interface DatedKind extends Dated {
  readonly kind: string;
}

export interface RetentionPolicy {
  /** The newest days with a Backup of which the newest Backup of each kind is kept. */
  readonly days: number;
  /** The newest weeks before those days of which the newest Backup is kept. */
  readonly weeks: number;
}

export const RETENTION: RetentionPolicy = { days: 7, weeks: 4 };

const UTC = resolveTimeZone("UTC").timeZone;

/** The UTC day of an Instant. */
function dayOf(instant: Instant): CalendarDay {
  return calendarDayOf(instant, UTC);
}

/** The week of a day, Monday to Sunday, named by its Monday. */
function weekStartOf(day: CalendarDay): CalendarDay {
  return weekOf(day, 1).first;
}

/**
 * The Backups to delete. Kept are the newest Backup of each kind of each of the newest `days`
 * days that have one, and before those the newest Backup of each of the newest `weeks` weeks
 * that have one. With one automatic Backup a day that is seven daily and four weekly Backups.
 * A second Backup of one kind on one day replaces the first, so pressing a button again and
 * again never fills the disk; a Backup of another kind never does, so the Backup from before a
 * migration outlives the daily one and the one taken by hand beside it.
 */
export function expiredBackups<Backup extends DatedKind>(
  backups: readonly Backup[],
  { days, weeks }: RetentionPolicy = RETENTION,
): Backup[] {
  // Instants sort as text in time order.
  const newestFirst = backups.toSorted((a, b) =>
    a.takenAt === b.takenAt ? 0 : a.takenAt < b.takenAt ? 1 : -1,
  );
  const keptDays = new Set<CalendarDay>();
  for (const backup of newestFirst) {
    if (keptDays.size < days) keptDays.add(dayOf(backup.takenAt));
  }
  const keptKinds = new Set<string>();
  const keptWeeks = new Set<CalendarDay>();
  const expired: Backup[] = [];
  for (const backup of newestFirst) {
    const day = dayOf(backup.takenAt);
    // The first Backup met in a day and kind, or in a week, is its newest.
    if (keptDays.has(day)) {
      const dayAndKind = `${day} ${backup.kind}`;
      if (keptKinds.has(dayAndKind)) expired.push(backup);
      else keptKinds.add(dayAndKind);
      continue;
    }
    const week = weekStartOf(day);
    if (!keptWeeks.has(week) && keptWeeks.size < weeks) keptWeeks.add(week);
    else expired.push(backup);
  }
  return expired;
}

/** Whether no Backup was taken on the UTC day of `now` yet: the daily one is due. */
export function isDailyBackupDue(backups: readonly Dated[], now: Instant): boolean {
  const today = dayOf(now);
  return !backups.some((backup) => dayOf(backup.takenAt) === today);
}
