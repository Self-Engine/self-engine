// Backups of the database file (D94): taken through SQLite's backup, kept as files in one folder,
// pruned to seven daily and four weekly, and restored at the next start of the Data Process.
// This package is the desktop's side of them; it needs a file system and the SQLite driver.

export {
  type Backups,
  type BackupsOptions,
  createBackups,
  type RestoreOutcome,
} from "./backups.ts";
export { DAILY_CHECK_INTERVAL_MS, type DailyBackupOptions, keepDailyBackups } from "./daily.ts";
export { RETENTION, type RetentionPolicy } from "./retention.ts";
export { applyStagedRestore } from "./staged-restore.ts";
