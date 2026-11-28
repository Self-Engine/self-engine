import type { DraftOfEntry } from "@self-engine/forms";
import type { timeTrackingContract } from "./contracts/index.ts";

/**
 * The fields create and edit share, as the edit's Draft holds them: derived from the one Field
 * List (ADR 0032), so a field's type follows its schema. The input of create is either shape; the
 * projects of an entry that is not work are only ever the empty list.
 */
export type EntryDraft = Pick<EditDraft, "startedAt" | "endedAt" | "note"> & {
  // Read-only, as create's shape that is not work holds only the empty list.
  readonly projects: Readonly<EditDraft["projects"]>;
};

type EditDraft = DraftOfEntry<typeof timeTrackingContract.edit>;

/** The draft's list of projects, the Lead Project first. */
export type ProjectsDraft = NonNullable<EntryDraft["projects"]>;

/**
 * The list after the picker chose `projectId` as the Lead Project, or cleared it with `null`: the
 * picker changes the Lead Project and leaves the other projects alone. A new project takes the
 * place and the Weight of the first item; a further project moves to the front, the others keep
 * their order; clearing removes the first item only.
 */
export function withLeadProject(projects: ProjectsDraft, projectId: string | null): ProjectsDraft {
  const [lead, ...rest] = projects;
  if (projectId === null) return rest;
  const chosen = projects.find((item) => item.projectId === projectId);
  if (chosen !== undefined && chosen === lead) return projects;
  if (chosen !== undefined) return [chosen, ...projects.filter((item) => item !== chosen)];
  return lead === undefined ? [{ projectId }] : [{ ...lead, projectId }, ...rest];
}
