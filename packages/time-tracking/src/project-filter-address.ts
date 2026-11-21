import { type ProjectId, projectIdSchema } from "@self-engine/projects/contracts";
import type { ViewSearch } from "@self-engine/shell";
import type { TimeEntryFilter } from "./contracts/days.ts";

const PARAMETER = "project";
export const NO_PROJECT = "none";

/** A primitive address selection, so week changes alone leave its subscribers alone. */
export type ProjectFilter = ProjectId | typeof NO_PROJECT | undefined;

export function shownProjectFilter(search: ViewSearch): ProjectFilter {
  const value = search[PARAMETER];
  if (value === NO_PROJECT) return NO_PROJECT;
  const parsed = projectIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function withProjectFilter(search: ViewSearch, filter: ProjectFilter): ViewSearch {
  const { [PARAMETER]: _previous, ...others } = search;
  return filter === undefined ? others : { ...others, [PARAMETER]: filter };
}

export function timeEntryFilter(filter: ProjectFilter): TimeEntryFilter | undefined {
  if (filter === undefined) return undefined;
  return filter === NO_PROJECT ? { kind: "noProject" } : { kind: "project", projectId: filter };
}
