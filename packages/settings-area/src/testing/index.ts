// For stories and tests only (D255): Fixed Answers for the Backups the View Data shows. The
// boundary rule keeps this entry, and the protocol schemas it loads, out of the app.

import type { PortAccess } from "@self-engine/data-client/react";
import {
  type FixedAnswerOptions,
  type FixedAnswers,
  fixedAnswers,
} from "@self-engine/data-client/testing";
import { type Backup, backupsContract } from "@self-engine/data-protocol";
import { requireInstant } from "@self-engine/time/testing";

const contracts = { backups: backupsContract };

/** What each entry of `backups` answers in a story. */
export type BackupAnswers = NonNullable<FixedAnswers<typeof contracts>["backups"]>;

export const BEFORE_RESTORE_BACKUP: Backup = {
  id: "2026-11-13T12-45-00-000Z-before-restore",
  takenAt: requireInstant("2026-11-13T12:45:00.000Z"),
  kind: "before-restore",
  sizeBytes: 2_150_400,
};
export const MANUAL_BACKUP: Backup = {
  id: "2026-11-13T12-30-00-000Z-manual",
  takenAt: requireInstant("2026-11-13T12:30:00.000Z"),
  kind: "manual",
  sizeBytes: 2_150_400,
};
export const DAILY_BACKUP: Backup = {
  id: "2026-11-13T07-00-00-000Z-daily",
  takenAt: requireInstant("2026-11-13T07:00:00.000Z"),
  kind: "daily",
  sizeBytes: 2_097_152,
};
export const BEFORE_MIGRATION_BACKUP: Backup = {
  id: "2026-11-02T09-15-00-000Z-before-migration",
  takenAt: requireInstant("2026-11-02T09:15:00.000Z"),
  kind: "before-migration",
  sizeBytes: 812_000,
};

/** What `list` answers for these Backups; the automatic ones succeed unless the story says so. */
export function listOf(backups: readonly Backup[], automaticBackupFailed = false) {
  return { data: { backups: [...backups], automaticBackupFailed } };
}

/** One Backup of each kind, newest first, as the Data Process lists them. */
export const SAMPLE_BACKUPS: readonly Backup[] = [
  BEFORE_RESTORE_BACKUP,
  MANUAL_BACKUP,
  DAILY_BACKUP,
  BEFORE_MIGRATION_BACKUP,
];

/**
 * The answers of a story where taking and restoring a Backup succeed. An Operation changes
 * nothing: the list stays as it is, and no restart of the Data Process follows a restore.
 */
export const SUCCEEDING: BackupAnswers = {
  list: listOf([MANUAL_BACKUP, DAILY_BACKUP, BEFORE_MIGRATION_BACKUP]),
  create: { data: MANUAL_BACKUP },
  restore: { data: BEFORE_RESTORE_BACKUP },
};

/** The Port access of a story: `answers` over the succeeding ones, checked against the contract. */
export function backupAnswers(
  answers: BackupAnswers = {},
  options?: FixedAnswerOptions,
): PortAccess {
  return fixedAnswers(contracts, { backups: { ...SUCCEEDING, ...answers } }, options);
}
