import { msg } from "@lingui/core/macro";
import { portHooks } from "@self-engine/data-client/react";
import type { Backup, BackupsContract } from "@self-engine/data-protocol";
import { useEffect, useState } from "react";

// The hooks for the Backups of the database (D94). They belong to no module: the Data Process
// answers them as `backups` beside `health`. The contract arrives as a type only, so its schemas
// never load in the app (D255).
const backupsPort = portHooks<BackupsContract>("backups");

export type { Backup };

/** The input of the list: it has no filters. */
const ALL_BACKUPS = {};

const useBackups = backupsPort.query("list");
/**
 * Backups are files, not rows: no Table Change says that the list changed, so the row that takes
 * a Backup reloads it (D250). After a restore the Data Process starts anew, and the reconnect
 * reloads it like every other answer.
 */
export const useReloadBackups = backupsPort.reload("list");

/**
 * The Backups that are kept, and whether the automatic ones are failing. An answer kept from an
 * earlier visit is read again when a row shows it: the Data Process takes Backups, and fails to,
 * while nobody looks, and no Table Change says so.
 */
export function useBackupList() {
  const state = useBackups(ALL_BACKUPS);
  const reload = useReloadBackups();
  const [keptFromEarlier] = useState(state.status !== "loading");
  useEffect(() => {
    if (keptFromEarlier) reload();
  }, [keptFromEarlier, reload]);
  return state;
}
export const useCreateBackup = backupsPort.operation("create");

/** No field shows a Backup that cannot be read: the building block shows the text (D264). */
const restoreHandling = {
  conflicts: {
    backup_unreadable: {
      text: msg`This backup can no longer be read. Nothing was restored.`,
      field: null,
    },
  },
} as const;

export const useRestoreBackup = backupsPort.operation("restore", restoreHandling);
/** `restore` for the undo of a restore, which may run after the row has left the screen (D261). */
export const restoreBackup = backupsPort.run("restore", restoreHandling);
