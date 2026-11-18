import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import type { Reason, Refusal } from "@self-engine/data-protocol";
import { notifyRefused } from "@self-engine/ui";
import { createElement, type ReactNode } from "react";
import type { RefusalTexts } from "./reason-texts.ts";

/** One way out the Notice of a Refusal offers, such as "Archive" beside a refused delete. */
export interface RefusalAction {
  readonly label: MessageDescriptor;
  readonly run: () => void;
}

/**
 * What a caller adds to the Notice of a Refusal of one call; the page passes it to `run`.
 * Never an "Undo": a refused change changed nothing.
 */
export interface RefusalNoticeOptions {
  /** The entry the call changes, by the name the person knows it by, such as its title. */
  readonly entry?: string;
  /** One way out, which the Notice offers beside the Reasons. */
  readonly action?: RefusalAction;
}

/** What the shared Notice of a Refusal shows: every Reason, and what the caller added. */
export type RefusedNotice = Refusal & RefusalNoticeOptions;

/**
 * Shows the shared Notice of a Refusal: the entry, then every Reason as its text, and the
 * caller's action. Each text is built while it is on screen, so it follows a language switch.
 */
export function showRefusal({ reasons, entry, action }: RefusedNotice, texts: RefusalTexts): void {
  const [first, ...rest] = reasons.map((reason) => createElement(ReasonLine, { reason, texts }));
  if (first === undefined) return;
  notifyRefused({
    ...(entry !== undefined && { entry }),
    reasons: [first, ...rest],
    ...(action && {
      action: { label: createElement(Translated, { message: action.label }), run: action.run },
    }),
  });
}

function ReasonLine({
  reason,
  texts,
}: {
  readonly reason: Reason;
  readonly texts: RefusalTexts;
}): ReactNode {
  return texts.describe(reason, useLingui().i18n);
}

function Translated({ message }: { readonly message: MessageDescriptor }): ReactNode {
  return useLingui().i18n._(message);
}
