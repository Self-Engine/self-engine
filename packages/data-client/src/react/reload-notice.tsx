import { Trans } from "@lingui/react/macro";
import type { Query } from "@tanstack/react-query";
import { notifyError } from "@self-engine/ui";

/**
 * Tells the user that an answer on screen may be outdated, because its reload failed (D257). The
 * query cache calls it once per failed call, however many hooks show the answer; cancelled calls
 * never reach it. A failed first load has no answer to keep: the View shows its error state, so
 * there is no Notice.
 */
export function noticeFailedReload(_error: Error, query: Query<unknown, unknown, unknown>): void {
  if (query.state.data === undefined) return;
  notifyError({
    message: <Trans>What you see may be outdated: it could not be reloaded.</Trans>,
  });
}
