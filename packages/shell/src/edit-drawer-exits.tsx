import { useWindowEvent } from "@mantine/hooks";
import { useCallback, useLayoutEffect, useRef } from "react";
import { type LeaveGuard, type LeavingAddress, useShellRouting } from "./routing.tsx";
import { useDiscardQuestion } from "./unsaved-changes.tsx";
import type { ViewSearch } from "./view-search.ts";

export const selectEditId = (search: ViewSearch) =>
  typeof search.edit === "string" ? search.edit : undefined;

const keepsTheEntry = (current: LeavingAddress, next: LeavingAddress) =>
  current.pathname === next.pathname && selectEditId(current.search) === selectEditId(next.search);

/**
 * Whether an Esc is the drawer's to answer: when the focus is in the drawer, or nowhere. A layer
 * a field opens over the drawer keeps the key. A popover holds the focus outside the drawer's
 * frame, and a list leaves it in its field, which carries Mantine's mark while the list is open.
 */
function escapeIsForTheDrawer(target: EventTarget | null, frame: HTMLElement | null): boolean {
  if (!(target instanceof Element) || target === document.body) return true;
  if (target.getAttribute("data-mantine-stop-propagation") === "true") return false;
  return frame?.contains(target) ?? false;
}

/**
 * Closes the drawer on Esc, in place of Mantine's Drawer. Mantine listens on the window while the
 * key is still on its way down, ahead of every layer in the page, and asks only for the mark on
 * the focused element: one Esc in a popover over the drawer closed both. This listens at the same
 * moment, so a list is still open when it asks. Returns the ref of the drawer's frame.
 */
export function useEscapeExit(enabled: boolean, close: () => void) {
  const frame = useRef<HTMLDivElement>(null);
  useWindowEvent(
    "keydown",
    (event) => {
      if (!enabled || event.key !== "Escape" || event.isComposing) return;
      if (escapeIsForTheDrawer(event.target, frame.current)) close();
    },
    { capture: true },
  );
  return frame;
}

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
