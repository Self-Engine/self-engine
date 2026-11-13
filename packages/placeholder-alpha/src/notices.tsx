import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { notifyError } from "@self-engine/ui";

/** A text in the language of the moment, so a notice follows a language switch. */
function MessageText({ text }: { readonly text: MessageDescriptor }) {
  return useLingui().i18n._(text);
}

/** Shows a conflict where no form field can: as an error notice. */
export function notifyConflict(text: MessageDescriptor): void {
  notifyError({ message: <MessageText text={text} /> });
}
