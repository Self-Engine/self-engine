// For stories and tests only (D255): Fixed Answers for `projects` and sample projects. The
// boundary rule keeps this entry, and the Contract schemas it loads, out of the app.

import type { PortAccess } from "@self-engine/data-client/react";
import {
  type FixedAnswerOptions,
  type FixedAnswers,
  fixedAnswers,
} from "@self-engine/data-client/testing";
import {
  type ProjectReference,
  projectReferenceSchema,
  projectsContract,
} from "../contracts/index.ts";
import { type PortCall, type ProjectsStoryPort, storyPortOf } from "./story-port.ts";

const contracts = { projects: projectsContract };

/** What each entry of `projects` answers in a story. */
export type ProjectsAnswers = NonNullable<FixedAnswers<typeof contracts>["projects"]>;

/** A well-formed project id, numbered: what the Data Process would hand out. */
export function sampleProjectId(index: number): string {
  return `01a1cfa1-0b00-7000-8000-${index.toString(16).padStart(12, "0")}`;
}

const project = (index: number, fields: { title: string; icon?: string; color?: string }) => ({
  id: sampleProjectId(index),
  title: fields.title,
  description: null,
  icon: fields.icon ?? null,
  color: fields.color ?? null,
  archivedAt: null,
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

/**
 * The answers of a story where every Operation succeeds and the active list holds six projects in
 * the order of creation. An Operation changes nothing: no Table Change follows.
 */
export const SUCCEEDING: ProjectsAnswers = {
  active: { data: [WEBSITE, GARDEN, TAX, DOCTORS, WORK, CAR] },
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

export type { PortCall, ProjectsStoryPort } from "./story-port.ts";

/**
 * The Port of a story that changes the stored projects under an open View (Changing Answers): it
 * answers `first` over the succeeding answers and writes down every Operation.
 */
export function projectsStoryPort(
  first: ProjectsAnswers = {},
  afterCall?: (call: PortCall, port: ProjectsStoryPort<ProjectsAnswers>) => void,
): ProjectsStoryPort<ProjectsAnswers> {
  return storyPortOf((answers) => projectsAnswers(answers), first, afterCall);
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

/** A project that was archived: absent from the active list. */
export const OLD_SITE = project(9, { title: "Old site", icon: "house", color: "grape" });
