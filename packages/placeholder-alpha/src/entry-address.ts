import { editDrawerEntries } from "@self-engine/shell";
import type { Entry } from "./port.ts";

/** Marks an entry's row, which takes the focus when its Edit Drawer closes (ADR 0041). */
export const entryControls = editDrawerEntries<Entry["id"]>();

/** The address of an entry that does not exist yet. */
export const NEW_ENTRY_ID = "new";
