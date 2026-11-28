// The projects of an entry as a list or a View reads them. Types only, so a View imports this file
// without loading a schema.
import type { ProjectReference } from "@self-engine/projects/contracts";
import type { ListedTimeEntry } from "./entries.ts";

/** The projects of an entry of a list: none for an entry that is not work. */
export const projectsOfListed = (entry: ListedTimeEntry) =>
  entry.timeKind === "work" ? entry.projects : [];

/** The Lead Project of an entry of a list, or of any entry read with its projects: `null` without one. */
export const leadProjectOfListed = (entry: ListedTimeEntry): ProjectReference | null =>
  projectsOfListed(entry)[0]?.project ?? null;
