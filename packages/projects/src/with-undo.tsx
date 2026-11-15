import { Trans } from "@lingui/react/macro";
import { notifyUndoable } from "@self-engine/ui";
import { type ReactNode, useCallback } from "react";
import {
  type Project,
  useArchiveProject,
  useDeleteProject,
  useRestoreProject,
  useUnarchiveProject,
} from "./port.ts";

type Run = (input: { readonly id: Project["id"] }) => Promise<{ readonly status: string }>;

/** Whether the project is left: changed, or gone already. False when the Operation failed. */
export type Leave = (id: Project["id"]) => Promise<boolean>;

/**
 * Runs `change` at once and, when it succeeded, shows `message` in a Notice whose undo runs
 * `undo`: the Notice offers the way back instead of asking first.
 */
function useWithUndo(change: Run, undo: Run, message: ReactNode): Leave {
  return useCallback(
    async (id: Project["id"]) => {
      const changed = await change({ id });
      // The building block has announced it: a project that is gone is left, a failure is not.
      if (changed.status !== "success") return changed.status === "notFound";
      notifyUndoable({
        message,
        // "Not found" and unexpected errors are announced by the building block.
        undo: async () => {
          await undo({ id });
        },
      });
      return true;
    },
    [change, undo, message],
  );
}

// Elements, not text: `Trans` translates when the Notice renders, in the language active then.
const DELETED = <Trans>Project deleted</Trans>;
const ARCHIVED = <Trans>Project archived</Trans>;
const UNARCHIVED = <Trans>Project unarchived</Trans>;

/**
 * Deletes with undo. Undo calls `restore`, which never meets a Conflict: another project may carry
 * the title by now (D328). It brings the project back as it was, archived or not.
 */
export function useDeleteWithUndo(): Leave {
  return useWithUndo(useDeleteProject().run, useRestoreProject().run, DELETED);
}

/** Archives with undo, which unarchives (D327). */
export function useArchiveWithUndo(): Leave {
  return useWithUndo(useArchiveProject().run, useUnarchiveProject().run, ARCHIVED);
}

/** Unarchives with undo, which archives again (D327). */
export function useUnarchiveWithUndo(): Leave {
  return useWithUndo(useUnarchiveProject().run, useArchiveProject().run, UNARCHIVED);
}
