import { Trans } from "@lingui/react/macro";
import { notifyUndoable } from "@self-engine/ui";
import { useCallback } from "react";
import { notifyConflict } from "./notices.tsx";
import { type Entry, useDeleteEntry, useRestoreEntry } from "./port.ts";

/**
 * Deleting happens at once: the notice offers the way back instead of asking first. Undo calls
 * `restore`; the restored entry keeps its place, as the list is ordered by creation. "Not found"
 * and unexpected errors are announced by the building block. The function stays the same object,
 * so a `memo` row that receives it does not draw again.
 */
export function useDeleteWithUndo(): (id: Entry["id"]) => Promise<void> {
  const { run: remove } = useDeleteEntry();
  const { run: restore } = useRestoreEntry();
  return useCallback(
    async (id) => {
      const deleted = await remove({ id });
      if (deleted.status !== "success") return;
      notifyUndoable({
        message: <Trans>Deleted</Trans>,
        undo: async () => {
          const restored = await restore({ id });
          if (restored.status === "conflict") notifyConflict(restored.text);
        },
      });
    },
    [remove, restore],
  );
}
