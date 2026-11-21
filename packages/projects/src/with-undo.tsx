import { Trans } from "@lingui/react/macro";
import { type RefusalNoticeOptions, useWithUndo } from "@self-engine/data-client/react";
import { notifyDone } from "@self-engine/ui";
import { useCallback } from "react";
import {
  type Project,
  useArchiveProject,
  useDeleteProject,
  useRestoreProject,
  useUnarchiveProject,
} from "./port.ts";

/** Whether the project is left: changed, or gone already. False when the Operation failed. */
type Leave = (id: Project["id"], refusal?: RefusalNoticeOptions) => Promise<boolean>;

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

/**
 * Archives without offering undo, for a caller that cannot know whether its archive changed the
 * project: an archive of an archived project writes nothing (D327), and an undo would then
 * unarchive what someone else archived. The Notice still says that the project is archived.
 */
export function useArchiveWithoutUndo(): Leave {
  const archive = useArchiveProject().run;
  return useCallback(
    async (id: Project["id"], refusal?: RefusalNoticeOptions) => {
      const archived = await archive({ id }, refusal);
      if (archived.status !== "success") return archived.status === "notFound";
      notifyDone({ message: ARCHIVED });
      return true;
    },
    [archive],
  );
}

/** Unarchives with undo, which archives again (D327). */
export function useUnarchiveWithUndo(): Leave {
  return useWithUndo(useUnarchiveProject().run, useArchiveProject().run, UNARCHIVED);
}
