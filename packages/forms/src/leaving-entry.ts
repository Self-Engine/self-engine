import { useRef, useState } from "react";

/** What `useLeavingEntry` gives the Edit Drawer of a stored entry. */
export interface LeavingEntry<Entry> {
  /**
   * The entry to show: the one found; while none is found, the last one, so an entry deleted
   * elsewhere stays readable with the warning (D324); and while the drawer leaves, the entry as it
   * was when it began to leave.
   */
  readonly entry: Entry | undefined;
  /** Whether the form should warn that its entry was deleted elsewhere. */
  readonly deleted: boolean;
  /**
   * Runs `operation`, an Operation that closes the drawer when it succeeds, such as a delete.
   * An activation while one runs, or while `confirm` asks, does nothing.
   * `confirm` runs first when given; when it declines, nothing else happens.
   * Calls the drawer's completion callback when the Operation answers true and keeps the lock
   * through closing. The Operation answers true when it succeeded or the entry was already gone.
   * A failed Operation releases the lock and shows the entry found again.
   */
  readonly leave: (
    operation: () => Promise<boolean>,
    confirm?: () => Promise<boolean>,
  ) => Promise<void>;
}

/**
 * The state of the Edit Drawer of a stored entry around an Operation that closes it (D324): it
 * keeps the last entry found, and once such an Operation began here, it keeps the entry as it was
 * until the drawer has closed, so the drawer does not flash "not found" while it slides out.
 */
export function useLeavingEntry<Entry>(
  found: Entry | undefined,
  onDone: () => void,
): LeavingEntry<Entry> {
  const [last, setLast] = useState(found);
  const [leaving, setLeaving] = useState(false);
  // A ref beside the state: two activations in one tick both read the state before it changes.
  const busy = useRef(false);
  if (!leaving && found !== undefined && found !== last) setLast(found);
  const leave = async (
    operation: () => Promise<boolean>,
    confirm?: () => Promise<boolean>,
  ): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    const goes = confirm === undefined || (await confirm());
    if (goes) setLeaving(true);
    if (goes && (await operation())) {
      onDone();
      return;
    }
    busy.current = false;
    setLeaving(false);
  };
  return {
    entry: leaving ? last : (found ?? last),
    deleted: found === undefined && !leaving,
    leave,
  };
}
