// Where the focus goes when the Edit Drawer closes (ADR 0041): on a control that continues the
// work, never on the page. A module only marks the control that stands for an entry and reports
// the entry it created; the rule is the Shell's, the same for every module.

import { useDidUpdate } from "@mantine/hooks";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { firstControlIn, takesTheFocus } from "./focusable.ts";

const ENTRY_ATTRIBUTE = "data-edit-entry";
const VIEW_ATTRIBUTE = "data-shell-view";

/** The mark on the element that holds the page of the View, which the Shell draws. */
export const VIEW_MARK = { [VIEW_ATTRIBUTE]: "" } as const;

/** What the control that stands for an entry carries. */
export interface EntryControlMark {
  readonly [ENTRY_ATTRIBUTE]: string;
}

/** The entries a module's Edit Drawer opens, by the type of their id. */
export interface EditDrawerEntries<Id extends string> {
  /**
   * Spread on the control that stands for the entry `id` in a View, such as the button of its
   * row, with the id the drawer's address carries. When the drawer closes, the Shell gives this
   * control the focus: after the entry was created there, and after an edit that no control
   * opened, such as one opened by its address. A constant attribute, so marking a row costs it
   * no draw.
   */
  readonly control: (id: Id) => EntryControlMark;
}

const ENTRIES: EditDrawerEntries<string> = { control: (id) => ({ [ENTRY_ATTRIBUTE]: id }) };

/**
 * The marks for the entries of one kind, such as `editDrawerEntries<ProjectId>()`: the compiler
 * then takes only such an id at a row, as the drawer's `onCreated` does with
 * `EditDrawerProps<ProjectId>`.
 */
export function editDrawerEntries<Id extends string>(): EditDrawerEntries<Id> {
  return ENTRIES;
}

/**
 * How long after the drawer closed the Shell still places the focus while the page changes: the
 * View's Query reloads after the Table Change of a save, which may come after the closing. A
 * created entry's control may appear only then, and a control the focus is on may leave, such as
 * the row of a deleted entry. Ended sooner by any key or press of the person.
 */
export const FOCUS_HOLD_MS = 2000;

/** Mantine waits as long before it returns the focus; a layer that closed with ours goes first. */
const SETTLE_MS = 10;

interface Closing {
  /** The drawer that closed, which still slides out. */
  readonly frame: HTMLElement | null;
  /** What had the focus when the drawer opened, outside it; none when nothing had. */
  readonly opener: HTMLElement | null;
  /** The address the drawer had open. */
  readonly entry: string | undefined;
  /** The entry the drawer created, as its module reported it. */
  readonly created: string | undefined;
}

const viewOnScreen = () => document.querySelector<HTMLElement>(`[${VIEW_ATTRIBUTE}]`);

const entryControlIn = (view: HTMLElement, id: string) =>
  view.querySelector<HTMLElement>(`[${ENTRY_ATTRIBUTE}="${CSS.escape(id)}"]`);

/**
 * The fixed place in the View: its first control, so that Tab goes on from the top of the page;
 * a field that would open its list on the focus is passed over. A View without any such control
 * takes the focus itself until the focus leaves it.
 */
function fixedPlaceIn(view: HTMLElement): HTMLElement {
  const first = firstControlIn(view);
  if (first !== undefined) return first;
  if (!view.hasAttribute("tabindex")) {
    view.setAttribute("tabindex", "-1");
    view.addEventListener("blur", () => view.removeAttribute("tabindex"), { once: true });
  }
  return view;
}

/**
 * Places the focus by the rule and keeps it placed for `FOCUS_HOLD_MS`: after a create on the
 * entry's control once the View shows it, and meanwhile on the fixed place; otherwise on the
 * control that opened the drawer while it is on the page, then on the entry's control, then on
 * the fixed place, each only if it can take the focus. It moves the focus only when it is nowhere, still in the leaving drawer, or
 * where this put it; a key or a press of the person ends it. Returns the function that ends it.
 */
function holdFocus(closing: Closing): () => void {
  let placed: HTMLElement | null = null;
  // A control that has left the page, is hidden or was disabled meanwhile is passed over. The one
  // that has the focus can take it, which spares the look at the layout while nothing changes.
  const usable = (control: HTMLElement | null) =>
    control !== null && (control === document.activeElement || takesTheFocus(control))
      ? control
      : null;
  const wanted = (view: HTMLElement) => {
    if (closing.created !== undefined) return usable(entryControlIn(view, closing.created));
    return (
      usable(closing.opener) ??
      (closing.entry === undefined ? null : usable(entryControlIn(view, closing.entry)))
    );
  };
  const mayMove = () => {
    const now = document.activeElement;
    return (
      now === null ||
      now === document.body ||
      now === placed ||
      (closing.frame?.contains(now) ?? false)
    );
  };
  const place = () => {
    const view = viewOnScreen();
    if (view === null || !mayMove()) return;
    const target = wanted(view) ?? fixedPlaceIn(view);
    if (target === document.activeElement) return;
    target.focus();
    placed = target;
  };
  // Only childList: the page adds and removes rows, while the drawer's exit only restyles it.
  const observer = new MutationObserver(place);
  const start = window.setTimeout(() => {
    place();
    observer.observe(document.body, { childList: true, subtree: true });
  }, SETTLE_MS);
  const end = window.setTimeout(() => stop(), FOCUS_HOLD_MS);
  const stop = () => {
    window.clearTimeout(start);
    window.clearTimeout(end);
    observer.disconnect();
    window.removeEventListener("keydown", stop, true);
    window.removeEventListener("pointerdown", stop, true);
  };
  window.addEventListener("keydown", stop, true);
  window.addEventListener("pointerdown", stop, true);
  return stop;
}

/**
 * Places the focus when the Edit Drawer closes, however it closed: Esc, a button, the overlay, a
 * save, a named Operation, "Discard" or the address. `frame` is the drawer; `entry` the address
 * it has open. Returns the function a create reports its new entry with, before the drawer closes.
 * Costs nothing while the drawer stays open or closed; no row takes part in it.
 */
export function useFocusWhenTheEditDrawerCloses(
  opened: boolean,
  entry: string | undefined,
  frame: RefObject<HTMLElement | null>,
) {
  const opener = useRef<HTMLElement | null>(null);
  const created = useRef<string | undefined>(undefined);
  const lastEntry = useRef(entry);
  useLayoutEffect(() => {
    lastEntry.current = entry;
  });
  // In the commit that opens it, before the drawer's trap takes the focus.
  useLayoutEffect(() => {
    if (!opened) return;
    const focused = document.activeElement;
    opener.current =
      focused instanceof HTMLElement &&
      focused !== document.body &&
      !frame.current?.contains(focused)
        ? focused
        : null;
    created.current = undefined;
  }, [opened, frame]);
  useDidUpdate(() => {
    if (opened) return undefined;
    return holdFocus({
      frame: frame.current,
      opener: opener.current,
      entry: lastEntry.current,
      created: created.current,
    });
  }, [opened]);
  return useCallback((id: string) => {
    created.current = id;
  }, []);
}
