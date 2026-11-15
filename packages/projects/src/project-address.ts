import type { WriteViewSearch } from "@self-engine/shell";

/** The address of a project that does not exist yet, in the Edit Drawer's `edit`. */
export const NEW_PROJECT_ID = "new";

/** Opens the Edit Drawer for a new project on the current page. */
export function openNewProject(writeSearch: WriteViewSearch) {
  writeSearch((search) => ({ ...search, edit: NEW_PROJECT_ID }));
}
