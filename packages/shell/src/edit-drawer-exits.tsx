import { Trans } from "@lingui/react/macro";
import { confirm } from "@self-engine/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type LeaveGuard, type LeavingAddress, useShellRouting } from "./routing.tsx";
import type { ViewSearch } from "./view-search.ts";

type UnsavedCheck = () => boolean;

export const UnsavedChangesContext = createContext<((check: UnsavedCheck) => () => void) | null>(
  null,
);

/**
 * Tells the Shell how to find out whether the drawer holds unsaved changes. It asks only when
 * someone tries to leave, so typing costs nothing. Several checks may exist: any true means ask.
 */
export function useUnsavedChanges(check: UnsavedCheck): void {
  const register = useContext(UnsavedChangesContext);
  if (register === null) throw new Error("useUnsavedChanges only works inside an edit drawer");
  const latest = useRef(check);
  // Before the paint, so that the question never sees the check of an earlier render.
  useLayoutEffect(() => {
    latest.current = check;
  });
  useLayoutEffect(() => register(() => latest.current()), [register]);
}

export const selectEditId = (search: ViewSearch) =>
  typeof search.edit === "string" ? search.edit : undefined;

const keepsTheEntry = (current: LeavingAddress, next: LeavingAddress) =>
  current.pathname === next.pathname && selectEditId(current.search) === selectEditId(next.search);

/** `openEntryKey` names what the drawer has open, and leaving it is what the guard watches. */
export function useEditDrawerExits(openEntryKey: string | undefined) {
  const { useLeaveGuard } = useShellRouting();
  const [checks] = useState(() => new Set<UnsavedCheck>());
  // A ref as well as the state: the guard has to see an open question before React has drawn it.
  const asking = useRef(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const finished = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    finished.current = false;
  }, [openEntryKey]);

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
    // On the document's body after a click on the overlay, which has no way back into the drawer.
    const focused = document.activeElement === document.body ? null : document.activeElement;
    asking.current = true;
    setQuestionOpen(true);
    const discard = await confirm({
      title: <Trans>Discard changes?</Trans>,
      message: <Trans>What you changed here will be lost.</Trans>,
      confirmLabel: <Trans>Discard</Trans>,
      cancelLabel: <Trans>Keep editing</Trans>,
      danger: true,
      // On "Discard" the drawer's own return to its opener has to win, so Mantine's stays out.
      returnFocus: false,
    });
    asking.current = false;
    setQuestionOpen(false);
    if (!discard) (focused instanceof HTMLElement ? focused : closeButton.current)?.focus();
    return discard;
  }, []);

  const guard = useCallback<LeaveGuard>(
    ({ current, next }) => {
      if (keepsTheEntry(current, next) || finished.current) return true;
      if (![...checks].some((check) => check())) return true;
      return asking.current ? false : askToDiscard();
    },
    [askToDiscard, checks],
  );
  useLeaveGuard(guard, openEntryKey !== undefined);

  /** After a successful save or delete: nothing is left to lose. */
  const letNextExitPass = useCallback(() => {
    finished.current = true;
  }, []);

  return { register, questionOpen, letNextExitPass, closeButton };
}
