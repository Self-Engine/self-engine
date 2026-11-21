import { Trans } from "@lingui/react/macro";
import { useWithUndo } from "@self-engine/data-client/react";
import { useDeleteEntry, useRestoreEntry } from "./port.ts";

const DELETED = <Trans>Deleted</Trans>;

/**
 * Undo calls `restore`; the restored entry keeps its place, as the list is ordered by creation.
 * Keep the message stable so a memoized row can reuse its delete callback.
 */
export function useDeleteWithUndo() {
  return useWithUndo(useDeleteEntry().run, useRestoreEntry().run, DELETED);
}
