import { Trans } from "@lingui/react/macro";
import { notifyUndoable } from "@self-engine/ui";
import { useCallback } from "react";
import { type Project, useDeleteProject, useRestoreProject } from "./port.ts";

/**
 * Deleting happens at once: the Notice offers the way back instead of asking first. Undo calls
 * `restore`, which never meets a Conflict: another project may carry the title by now (D328).
 */
export function useDeleteWithUndo(): (id: Project["id"]) => Promise<void> {
  const { run: remove } = useDeleteProject();
  const { run: restore } = useRestoreProject();
  return useCallback(
    async (id) => {
      const deleted = await remove({ id });
      if (deleted.status !== "success") return;
      notifyUndoable({
        message: <Trans>Project deleted</Trans>,
        // "Not found" and unexpected errors are announced by the building block.
        undo: async () => {
          await restore({ id });
        },
      });
    },
    [remove, restore],
  );
}
