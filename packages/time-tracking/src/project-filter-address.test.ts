import { WEBSITE } from "@self-engine/projects/testing";
import { expect, test } from "vite-plus/test";
import {
  shownProjectFilter,
  timeEntryFilter,
  withProjectFilter,
} from "./project-filter-address.ts";

test("a project id and no project round-trip beside the week", () => {
  const week = { week: "2026-11-09" };
  const project = withProjectFilter(week, WEBSITE.id);
  const unassigned = withProjectFilter(week, "none");

  expect(project).toEqual({ ...week, project: WEBSITE.id });
  expect(timeEntryFilter(shownProjectFilter(project))).toEqual({
    kind: "project",
    projectId: WEBSITE.id,
  });
  expect(unassigned).toEqual({ ...week, project: "none" });
  expect(timeEntryFilter(shownProjectFilter(unassigned))).toEqual({ kind: "noProject" });
  expect(withProjectFilter(project, undefined)).toEqual(week);
});

test("a missing or unrecognized value means all entries", () => {
  for (const project of [undefined, null, 42, "other", "all", [WEBSITE.id]]) {
    expect(timeEntryFilter(shownProjectFilter({ project }))).toBeUndefined();
  }
});
