import { useCallback, useLayoutEffect, useRef } from "react";
import { type LeaveGuard, type LeavingAddress, useShellRouting } from "./routing.tsx";
import { useDiscardQuestion } from "./frame-exits.tsx";
import type { ViewSearch } from "./view-search.ts";

export const selectEditId = (search: ViewSearch) =>
  typeof search.edit === "string" ? search.edit : undefined;

const keepsTheEntry = (current: LeavingAddress, next: LeavingAddress) =>
  current.pathname === next.pathname && selectEditId(current.search) === selectEditId(next.search);

/**
 * `openEntryKey` names what the drawer has open, leaving it is what the guard watches. It names
 * one opening: an opening of the same entry again has another key, so that a save which ends after
 * its opening was left knows it no longer speaks for what is open now.
 */
export function useEditDrawerExits(openEntryKey: string | undefined) {
  const { useLeaveGuard } = useShellRouting();
  const finished = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const openNow = useRef(openEntryKey);

  // Within the commit that draws the new opening: a save's Promise continues only once that commit
  // has returned, while passive effects may run later still, such as after a transition. So a save
  // of the opening before, resolved while the new one commits, already finds itself replaced.
  useLayoutEffect(() => {
    finished.current = false;
    openNow.current = openEntryKey;
  }, [openEntryKey]);

  // Back where it was, or where the drawer starts when the focus was nowhere, such as after a
  // click on the overlay, which has no way back into the drawer.
  const { register, questionOpen, confirmDiscard } = useDiscardQuestion((focused) =>
    focused instanceof HTMLElement ? focused : closeButton.current,
  );

  const guard = useCallback<LeaveGuard>(
    ({ current, next }) =>
      keepsTheEntry(current, next) || finished.current ? true : confirmDiscard(),
    [confirmDiscard],
  );
  useLeaveGuard(guard, openEntryKey !== undefined);

  /**
   * Whether the opening `openedAs` names is still the one open: not once the person left it, also
   * while the drawer slides out, nor once another opening took its place. Read when asked.
   */
  const isOpen = useCallback((openedAs: string) => openedAs === openNow.current, []);

  /**
   * After a successful save or delete in the opening `openedAs` names: nothing is left to lose,
   * so the next exit passes. An opening that is no longer the open one lets nothing pass, and
   * the result says so: its drawer was left, and closing would close what is open now.
   */
  const letNextExitPass = useCallback(
    (openedAs: string) => {
      if (!isOpen(openedAs)) return false;
      finished.current = true;
      return true;
    },
    [isOpen],
  );

  return {
    register,
    questionOpen,
    isOpen,
    letNextExitPass,
    confirmDiscard,
    closeButton,
  };
}
