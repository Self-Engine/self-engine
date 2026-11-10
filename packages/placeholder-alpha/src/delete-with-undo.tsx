import { Trans } from "@lingui/react/macro";
import { notifyUndoable } from "@self-engine/ui";
import { deleteEntry, restoreEntry } from "./entry-store.ts";

/** Deleting happens at once: the notice offers the way back instead of asking first. */
export function deleteWithUndo(id: string) {
  deleteEntry(id);
  notifyUndoable({ message: <Trans>Deleted</Trans>, undo: () => restoreEntry(id) });
}
