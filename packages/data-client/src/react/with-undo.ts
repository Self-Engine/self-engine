import { notifyUndoable } from "@self-engine/ui";
import { type ReactNode, useCallback } from "react";
import type { OperationResult } from "./operation-hook.ts";
import type { RefusalNoticeOptions } from "./refusal-notice.ts";

type Run<Id> = (
  input: { readonly id: Id },
  refusal?: RefusalNoticeOptions,
) => Promise<Pick<OperationResult<unknown, string, "id">, "status">>;

/**
 * Runs an Operation and, on success, shows a Notice whose Undo runs the inverse Operation.
 * Returns true when the entry was changed or was already gone.
 * The Operation hooks handle their own Notices for Refusals and errors.
 */
export function useWithUndo<Id>(
  change: Run<Id>,
  undo: Run<NoInfer<Id>>,
  message: ReactNode,
): (id: Id, refusal?: RefusalNoticeOptions) => Promise<boolean> {
  return useCallback(
    async (id: Id, refusal?: RefusalNoticeOptions) => {
      const result = await change({ id }, refusal);
      if (result.status !== "success") return result.status === "notFound";
      notifyUndoable({
        message,
        undo: async () => {
          await undo({ id });
        },
      });
      return true;
    },
    [change, undo, message],
  );
}
