// The question before unsaved changes are lost, shared by the Edit Drawer and the Indicator
// Panel: a form reports its changes through one hook in both, and both ask the same question.

import { Trans } from "@lingui/react/macro";
import { confirm } from "@self-engine/ui";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";

type UnsavedCheck = () => boolean;

export const UnsavedChangesContext = createContext<((check: UnsavedCheck) => () => void) | null>(
  null,
);

/**
 * Tells the Shell how to find out whether the Edit Drawer or the Indicator Panel around it holds
 * unsaved changes. It asks only when someone tries to leave, so typing costs nothing. Several
 * checks may exist: any true means ask.
 */
export function useUnsavedChanges(check: UnsavedCheck): void {
  const register = useContext(UnsavedChangesContext);
  if (register === null) {
    throw new Error("useUnsavedChanges only works inside an Edit Drawer or an Indicator Panel");
  }
  const latest = useRef(check);
  // Before the paint, so that the question never sees the check of an earlier render.
  useLayoutEffect(() => {
    latest.current = check;
  });
  useLayoutEffect(() => register(() => latest.current()), [register]);
}

/**
 * Where the focus goes on "Keep editing", given where it was when the question opened: `null`
 * when it was nowhere, such as after a click on an overlay.
 */
export type KeepEditingFocus = (focusedBefore: Element | null) => HTMLElement | null | undefined;

/**
 * The checks of one frame and the question they lead to. Hand `register` to the content through
 * `UnsavedChangesContext`; `confirmDiscard` answers whether unsaved changes may go.
 */
export function useDiscardQuestion(keepEditingFocus: KeepEditingFocus) {
  const [checks] = useState(() => new Set<UnsavedCheck>());
  // A ref as well as the state: a second attempt has to see an open question before React drew it.
  const asking = useRef(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const focusOnKeep = useRef(keepEditingFocus);
  useLayoutEffect(() => {
    focusOnKeep.current = keepEditingFocus;
  });

  const register = useCallback(
    (check: UnsavedCheck) => {
      checks.add(check);
      return () => {
        checks.delete(check);
      };
    },
    [checks],
  );

  const askToDiscard = useCallback(async () => {
    // Read before the question takes the focus: on the document's body nothing was focused.
    const focused = document.activeElement === document.body ? null : document.activeElement;
    asking.current = true;
    setQuestionOpen(true);
    const discard = await confirm({
      title: <Trans>Discard changes?</Trans>,
      message: <Trans>What you changed here will be lost.</Trans>,
      confirmLabel: <Trans>Discard</Trans>,
      cancelLabel: <Trans>Keep editing</Trans>,
      danger: true,
      // On "Discard" the frame's own return to its opener has to win, so Mantine's stays out.
      returnFocus: false,
    });
    asking.current = false;
    setQuestionOpen(false);
    if (!discard) focusOnKeep.current(focused)?.focus();
    return discard;
  }, []);

  /** Whether unsaved changes may go: asks when there are any, and never twice at once. */
  const confirmDiscard = useCallback(async () => {
    if (![...checks].some((check) => check())) return true;
    return asking.current ? false : askToDiscard();
  }, [askToDiscard, checks]);

  return { register, questionOpen, confirmDiscard };
}
