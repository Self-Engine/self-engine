import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Why a Backup was taken: once a day, before pending migrations ran, because the user asked, or
 * to keep the data a restore replaces (D94).
 */
export const backupKindSchema = z.enum(["daily", "before-migration", "manual", "before-restore"]);

export type BackupKind = z.infer<typeof backupKindSchema>;

/** One Backup: a copy of the whole database, kept in the data folder of the channel. */
export const backupSchema = z.object({
  /** Names the Backup among those kept. Not a row id: Backups are files, not rows. */
  id: z.string(),
  /** When it was taken, as a UTC instant. */
  takenAt: z.iso.datetime(),
  kind: backupKindSchema,
  sizeBytes: z.number().int().nonnegative(),
});

export type Backup = z.infer<typeof backupSchema>;

/** What the list of Backups answers: the Backups, and whether the automatic ones are failing. */
export const backupListSchema = z.object({
  /** Every Backup that is kept, newest first. */
  backups: z.array(backupSchema),
  /**
   * True while the last attempt at an automatic Backup failed and no Backup has succeeded since:
   * the data is not being backed up, for example because the disk is full.
   */
  automaticBackupFailed: z.boolean(),
});

export type BackupList = z.infer<typeof backupListSchema>;

const nothing = z.object({});

/**
 * Backups of the database (D94). They belong to no module, so the Data Process answers them
 * beside `health`, on every platform that keeps Backups.
 */
export const backupsContract = {
  /** A Query: the Backups that are kept and how the automatic ones fare. No table holds them (D250). */
  list: oc.input(nothing).output(backupListSchema),
  /** Takes a Backup now and answers with it. */
  create: oc.input(nothing).output(backupSchema),
  /**
   * Replaces the database with the Backup `id`. The data it replaces is backed up first, and that
   * Backup is the answer, so the restore can be taken back. The Data Process then starts anew:
   * the page's connection is lost for a moment and every answer reloads (D250).
   */
  restore: oc
    .input(z.object({ id: z.string() }))
    .output(backupSchema)
    .errors({
      NOT_FOUND: {},
      // The file is no sound database any more; nothing was replaced.
      CONFLICT: { data: z.object({ reason: z.literal("backup_unreadable") }) },
    }),
};

export type BackupsContract = typeof backupsContract;
