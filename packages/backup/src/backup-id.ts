import { type BackupKind, backupKindSchema } from "@self-engine/data-protocol";
import { type Instant, instantSchema } from "@self-engine/time";

/** The extension of a Backup's file; its name without it is the Backup's id. */
export const BACKUP_EXTENSION = ".sqlite";

const KINDS: readonly string[] = backupKindSchema.options;
const ID = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-([a-z-]+)$/;

/**
 * The id of the Backup of this kind taken at this instant, such as
 * `2026-11-13T08-37-51-194Z-manual`. It is the file's name too, so the folder is the only record
 * of the Backups, and its names sort by time.
 */
export function backupId(takenAt: Instant, kind: BackupKind): string {
  return `${takenAt.replaceAll(/[:.]/g, "-")}-${kind}`;
}

/**
 * What an id says about its Backup; `undefined` for anything that is not an id this app wrote.
 * Every id from outside passes through here before it becomes part of a path.
 */
export function parseBackupId(
  id: string,
): { readonly takenAt: Instant; readonly kind: BackupKind } | undefined {
  const match = ID.exec(id);
  if (match === null) return undefined;
  const [, day, hours, minutes, seconds, milliseconds, kind] = match;
  if (kind === undefined || !KINDS.includes(kind)) return undefined;
  // A date like the 31st of February is no Instant: not an id this app wrote.
  const takenAt = instantSchema.safeParse(`${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`);
  if (!takenAt.success) return undefined;
  return { takenAt: takenAt.data, kind: kind as BackupKind };
}
