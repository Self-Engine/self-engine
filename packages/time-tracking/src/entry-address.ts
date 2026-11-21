// No schema here: the week loads this file, and the schemas must not load with a View (D255).
// The Edit Drawer, which loads with them, reads an address.
import type { WriteViewSearch } from "@self-engine/shell";
import type { CalendarDay } from "@self-engine/time";

/**
 * The address of a time entry that does not exist yet, in the Edit Drawer's `edit`: "new" for
 * today, or "new-" and the day that was clicked in the week. The day travels in the one value the
 * Shell clears when the drawer closes, and a reload or a deep link opens the same day.
 */
export const NEW_ENTRY = "new";
export const NEW_ENTRY_ON = `${NEW_ENTRY}-`;

/** The address of a new entry, on `day` or, without one, on today. */
export function newEntryAddress(day?: CalendarDay): string {
  return day === undefined ? NEW_ENTRY : `${NEW_ENTRY_ON}${day}`;
}

/** Opens the Edit Drawer for a new entry on the current page, on `day` or on today. */
export function openNewTimeEntry(writeSearch: WriteViewSearch, day?: CalendarDay) {
  writeSearch((search) => ({ ...search, edit: newEntryAddress(day) }));
}
