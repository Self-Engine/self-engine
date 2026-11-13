import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { Query } from "@tanstack/react-query";

/** Shown when a reload failed while an answer is on screen (D257). */
export const RELOAD_FAILED_NOTICE = msg`What you see may be outdated: it could not be reloaded.`;

/**
 * Tells the user that an answer on screen may be outdated, because its reload failed (D257). The
 * query cache calls the returned function once per failed call, however many hooks show the
 * answer; cancelled calls never reach it. A failed first load has no answer to keep: the View shows
 * its error state, so there is no Notice. The Notice goes through the provider's `notify`, like the
 * building block's other notices.
 */
export function noticeFailedReload(
  notify: (notice: MessageDescriptor) => void,
): (error: Error, query: Query<unknown, unknown, unknown>) => void {
  return (_error, query) => {
    if (query.state.data !== undefined) notify(RELOAD_FAILED_NOTICE);
  };
}
