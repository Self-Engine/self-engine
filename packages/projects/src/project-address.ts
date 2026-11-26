import { editDrawerEntries, type WriteViewSearch } from "@self-engine/shell";
import type { Project } from "./port.ts";

/** The address of a project that does not exist yet, in the Edit Drawer's `edit`. */
export const NEW_PROJECT_ID = "new";

/** Marks a project's row, which takes the focus when its Edit Drawer closes (ADR 0041). */
export const projectEntries = editDrawerEntries<Project["id"]>();

/** Opens the Edit Drawer for a new project on the current page. */
export function openNewProject(writeSearch: WriteViewSearch) {
  writeSearch((search) => ({ ...search, edit: NEW_PROJECT_ID }));
}
