import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { notifyError } from "@self-engine/ui";

const START_FAILED = msg`The action could not be completed. Please try again.`;

/**
 * Keeps the cause for the log and tells the person, for an action a person started that failed:
 * a Command, or the opening of an Indicator Panel. `i18n` so that an effect can depend on it.
 */
export function reportFailedStart(i18n: I18n, error: unknown) {
  console.error(error);
  notifyError({ message: i18n._(START_FAILED) });
}
