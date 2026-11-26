// The ways out the Edit Drawer and the Indicator Panel share: a form reports its unsaved changes
// through one hook in both, both ask the same question before they are lost, and both close on
// Esc the same way.

import { Trans } from "@lingui/react/macro";
import { useWindowEvent } from "@mantine/hooks";
import { confirm, LoadingState } from "@self-engine/ui";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { LazyContribution, type LazyComponents, type LoadComponent } from "./lazy-contribution.tsx";

/**
 * The Edit Drawer's frame while it is open, which carries the mark `data-edit-drawer-open` then.
 * Its overlay covers the Shell's header, so an Indicator Panel that closes over it gives the focus
 * to the drawer, not to the indicator behind the overlay.
 */
export const openEditDrawer = () => document.querySelector<HTMLElement>("[data-edit-drawer-open]");

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
type KeepEditingFocus = (focusedBefore: Element | null) => HTMLElement | null | undefined;

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
    // Back where it was, before the question's button leaves with it: the frame then places the
    // focus as it does for every other way out, which needs it there or nowhere.
    else if (focused instanceof HTMLElement && focused.isConnected) {
      focused.focus({ preventScroll: true });
    }
    return discard;
  }, []);

  /** Whether unsaved changes may go: asks when there are any, and never twice at once. */
  const confirmDiscard = useCallback(async () => {
    if (![...checks].some((check) => check())) return true;
    return asking.current ? false : askToDiscard();
  }, [askToDiscard, checks]);

  return { register, questionOpen, confirmDiscard };
}

/**
 * Whether an Esc is the frame's to answer: when the focus is in the frame, or nowhere. A layer a
 * field opens over the frame keeps the key. A popover holds the focus outside the frame, and a
 * list leaves it in its field, which carries Mantine's mark while the list is open.
 */
function escapeIsForTheFrame(
  target: EventTarget | null,
  frame: HTMLElement | null,
  covered: boolean,
): boolean {
  if (!(target instanceof Element) || target === document.body) return !covered;
  if (target.getAttribute("data-mantine-stop-propagation") === "true") return false;
  return frame?.contains(target) ?? false;
}

/**
 * Closes the frame on Esc, in place of Mantine's Drawer and Popover. Mantine listens on the window
 * while the key is still on its way down, ahead of every layer in the page, and asks only for the
 * mark on the focused element: one Esc in a popover over the Edit Drawer closed both. This listens
 * at the same moment, so a list is still open when it asks. Returns the ref of the frame.
 */
export function useEscapeExit(
  enabled: boolean,
  close: () => void,
  /** Whether another frame lies over this one right now: an Esc with the focus nowhere is its. */
  isCovered: () => boolean = () => false,
) {
  const frame = useRef<HTMLDivElement>(null);
  useWindowEvent(
    "keydown",
    (event) => {
      if (!enabled || event.key !== "Escape" || event.isComposing) return;
      if (escapeIsForTheFrame(event.target, frame.current, isCovered())) close();
    },
    { capture: true },
  );
  return frame;
}

interface FrameContentProps<Props extends object> {
  /** Names the opening the content is shown for: another opening mounts it anew. */
  readonly opening: string | number;
  /** The frame's checks, from `useDiscardQuestion`, which the content reports its changes to. */
  readonly register: ReturnType<typeof useDiscardQuestion>["register"];
  readonly components: LazyComponents<Props>;
  readonly load: LoadComponent<Props>;
  readonly props: Props;
}

/**
 * A module's content in a frame of the Shell: loaded when first shown, with a loading state until
 * then, mounted anew for each opening, and reporting its unsaved changes to the frame.
 */
export function FrameContent<Props extends object>({
  opening,
  register,
  ...contribution
}: FrameContentProps<Props>) {
  return (
    <UnsavedChangesContext value={register}>
      <LazyContribution key={opening} fallback={<LoadingState />} {...contribution} />
    </UnsavedChangesContext>
  );
}
