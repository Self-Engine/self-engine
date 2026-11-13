import { type BackupKind, backupKindSchema } from "@self-engine/data-protocol";

/** The extension of a Backup's file; its name without it is the Backup's id. */
export const BACKUP_EXTENSION = ".sqlite";

const KINDS: readonly string[] = backupKindSchema.options;
const ID = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-([a-z-]+)$/;

/**
 * The id of the Backup of this kind taken at this instant, such as
 * `2026-11-13T08-37-51-194Z-manual`. It is the file's name too, so the folder is the only record
 * of the Backups, and its names sort by time.
 */
export function backupId(takenAt: Date, kind: BackupKind): string {
  return `${takenAt.toISOString().replaceAll(/[:.]/g, "-")}-${kind}`;
}

/**
 * What an id says about its Backup; `undefined` for anything that is not an id this app wrote.
 * Every id from outside passes through here before it becomes part of a path.
 */
export function parseBackupId(
  id: string,
): { readonly takenAt: string; readonly kind: BackupKind } | undefined {
  const match = ID.exec(id);
  if (match === null) return undefined;
  const [, day, hours, minutes, seconds, milliseconds, kind] = match;
  if (kind === undefined || !KINDS.includes(kind)) return undefined;
  const takenAt = `${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
  // A date like the 31st of February parses to another day: not an instant this app wrote.
  const parsed = new Date(takenAt);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== takenAt) return undefined;
  return { takenAt, kind: kind as BackupKind };
}
