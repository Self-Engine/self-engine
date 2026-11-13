import type { Backups } from "./backups.ts";

/** How often a running Data Process asks whether the daily Backup is due. */
export const DAILY_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** The part of the platform's timers the schedule uses; a test passes its own. */
export interface IntervalTimer {
  setInterval(callback: () => void, milliseconds: number): unknown;
}

export interface DailyBackupOptions {
  readonly timer?: IntervalTimer;
  /** Told when a daily Backup fails. The schedule goes on: the next check tries again. */
  readonly onError: (error: unknown) => void;
}

/**
 * Takes the daily Backup now if it is due, and asks again every hour, so an app that stays open
 * for days is still backed up every day (D94). Call it once the Data Process serves: the Backup
 * then delays no answer.
 */
export function keepDailyBackups(
  backups: Pick<Backups, "backUpIfDue">,
  { timer = globalThis, onError }: DailyBackupOptions,
): void {
  const check = () => {
    backups.backUpIfDue().catch(onError);
  };
  check();
  timer.setInterval(check, DAILY_CHECK_INTERVAL_MS);
}
