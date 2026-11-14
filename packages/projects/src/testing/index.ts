// For stories and tests only (D255): Fixed Answers for `projects` and sample projects. The
// boundary rule keeps this entry, and the Contract schemas it loads, out of the app.

import type { PortAccess } from "@self-engine/data-client/react";
import {
  changingAnswers,
  type FixedAnswerOptions,
  type FixedAnswers,
  fixedAnswers,
} from "@self-engine/data-client/testing";
import {
  type ProjectId,
  projectIdSchema,
  type ProjectReference,
  projectReferenceSchema,
  projectsContract,
} from "../contracts/index.ts";

const contracts = { projects: projectsContract };

/** What each entry of `projects` answers in a story. */
export type ProjectsAnswers = NonNullable<FixedAnswers<typeof contracts>["projects"]>;

/** A well-formed project id, numbered: what the Data Process would hand out. */
export function sampleProjectId(index: number): ProjectId {
  return projectIdSchema.parse(`01a1cfa1-0b00-7000-8000-${index.toString(16).padStart(12, "0")}`);
}

const project = (
  index: number,
  fields: { title: string; icon?: string; color?: string; archivedAt?: string },
) => ({
  id: sampleProjectId(index),
  title: fields.title,
  description: null,
  icon: fields.icon ?? null,
  color: fields.color ?? null,
  archivedAt: fields.archivedAt ?? null,
});

/** With an icon and a color. */
export const WEBSITE = project(1, { title: "Website", icon: "house", color: "teal" });
/** With an emoji and no color. */
export const GARDEN = project(2, { title: "Garden", icon: "🌱" });
/** Without icon and color: its row shows the projects icon. */
export const TAX = project(3, { title: "Tax" });
/** An umlaut, which the page sorts between "Arbeit" and "Auto" in both languages. */
export const DOCTORS = project(4, { title: "Ärzte", color: "red" });
export const WORK = project(5, { title: "Arbeit" });
export const CAR = project(6, { title: "Auto" });
/** Archived, with an icon and a color. */
export const OLD_SHOP = project(10, {
  title: "Old shop",
  icon: "house",
  color: "orange",
  archivedAt: "2026-03-01T09:00:00.000Z",
});
/** Archived, without icon and color; created first and sorted after "Old shop". */
export const TAX_2025 = project(11, { title: "Tax 2025", archivedAt: "2026-02-01T09:00:00.000Z" });

/**
 * The answers of a story where every Operation succeeds, the active list holds six projects and the
 * archived list two, in the order of creation. An Operation changes nothing: no Table Change
 * follows.
 */
export const SUCCEEDING: ProjectsAnswers = {
  active: { data: [WEBSITE, GARDEN, TAX, DOCTORS, WORK, CAR] },
  archived: { data: [TAX_2025, OLD_SHOP] },
  archive: { data: { ...WEBSITE, archivedAt: "2026-11-12T12:00:00.000Z" } },
  unarchive: { data: { ...OLD_SHOP, archivedAt: null } },
  create: { data: project(7, { title: "New project" }) },
  edit: { data: WEBSITE },
  delete: { data: WEBSITE },
  restore: { data: WEBSITE },
};

/** The Port access of a story: `answers` over the succeeding ones, checked against the Contract. */
export function projectsAnswers(
  answers: ProjectsAnswers = {},
  options?: FixedAnswerOptions,
): PortAccess {
  return fixedAnswers(contracts, { projects: { ...SUCCEEDING, ...answers } }, options);
}

export interface PortCall {
  readonly entry: string;
  readonly input: unknown;
}

/**
 * The Port of a story that changes the stored projects under an open View, as another window, an
 * assistant or the sync would (Changing Answers), with every Operation written down, so a story
 * asserts which call reached the Port.
 */
export interface ProjectsStoryPort {
  readonly access: PortAccess;
  /** Every Operation that reached the Port, in order; the reloads of a Query are left out. */
  readonly calls: PortCall[];
  /** Answers `next` over the succeeding answers from now on, and delivers the Table Change. */
  readonly change: (next: ProjectsAnswers) => void;
}

/** The table of `projects`, as the Data Process's Query-to-tables list names it (D248). */
const TABLE = "projects";

/**
 * A story Port that answers `first` over the succeeding answers. `afterCall` runs after each
 * Operation answered, so a story can change the stored projects the way that Operation would.
 */
export function projectsStoryPort(
  first: ProjectsAnswers = {},
  afterCall?: (call: PortCall, port: ProjectsStoryPort) => void,
): ProjectsStoryPort {
  const changing = changingAnswers(projectsAnswers(first), {
    projects: { active: [TABLE], archived: [TABLE] },
  });
  const calls: PortCall[] = [];
  const port: ProjectsStoryPort = {
    calls,
    access: {
      ...changing.access,
      async call(module, entry, input, signal) {
        if (changing.access.describeEntry(module, entry)?.kind === "query")
          return changing.access.call(module, entry, input, signal);
        const call = { entry, input };
        calls.push(call);
        const answer = await changing.access.call(module, entry, input, signal);
        afterCall?.(call, port);
        return answer;
      },
    },
    change: (next) => changing.change(projectsAnswers(next), [TABLE]),
  };
  return port;
}

/** Another project titled "Website": only its mark tells it apart in the picker. */
export const WEBSITE_TWIN = project(8, { title: "Website", icon: "🌐", color: "orange" });

/** A project as a module above refers to it (D330), with its archive and deletion marks. */
export function projectReference(
  of: typeof WEBSITE,
  marks: { archivedAt?: string; deletedAt?: string } = {},
): ProjectReference {
  return projectReferenceSchema.parse({
    id: of.id,
    title: of.title,
    icon: of.icon,
    color: of.color,
    archivedAt: marks.archivedAt ?? of.archivedAt,
    deletedAt: marks.deletedAt ?? null,
  });
}

/** An archived project that a module above still refers to: in neither list of the answers. */
export const OLD_SITE = project(9, {
  title: "Old site",
  icon: "house",
  color: "grape",
  archivedAt: "2026-03-01T09:00:00.000Z",
});
