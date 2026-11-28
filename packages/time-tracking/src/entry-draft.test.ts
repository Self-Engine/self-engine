import { expect, test } from "vite-plus/test";
import { withLeadProject } from "./entry-draft.ts";

const website = { projectId: "website", weight: 2 };
const shop = { projectId: "shop", weight: 1 };
const blog = { projectId: "blog" };

test("a new project replaces the Lead Project, keeps its Weight and the rest of the list", () => {
  expect(withLeadProject([website, shop, blog], "other")).toEqual([
    { projectId: "other", weight: 2 },
    shop,
    blog,
  ]);
});

test("a further project moves to the front, the others keep their order", () => {
  expect(withLeadProject([website, shop, blog], "blog")).toEqual([blog, website, shop]);
});

test("the Lead Project chosen again leaves the list as it is", () => {
  const list = [website, shop];
  expect(withLeadProject(list, "website")).toBe(list);
});

test("clearing removes the first item only", () => {
  expect(withLeadProject([website, shop, blog], null)).toEqual([shop, blog]);
});

test("an entry with at most one project gets that one project or none", () => {
  expect(withLeadProject([], "website")).toEqual([{ projectId: "website" }]);
  expect(withLeadProject([], null)).toEqual([]);
  expect(withLeadProject([blog], "shop")).toEqual([{ projectId: "shop" }]);
  expect(withLeadProject([blog], null)).toEqual([]);
});
