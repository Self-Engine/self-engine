import type { MessageDescriptor } from "@lingui/core";
import { expect, test } from "vite-plus/test";
import { type HitGroup, type SearchableRow, searchedRows, searchHits } from "./search.ts";

const text = (message: string): MessageDescriptor => ({ id: message, message });

const row = (
  id: string,
  view: string,
  title: string,
  more: Partial<Pick<SearchableRow, "description" | "searchWords" | "values">> = {},
): SearchableRow => ({ id, view, title: text(title), searchWords: [], values: [], ...more });

const english = (descriptor: MessageDescriptor) => descriptor.message!;

const GERMAN: Readonly<Record<string, string>> = {
  Density: "Dichte",
  Compact: "Kompakt",
  Comfortable: "Komfortabel",
  "Font scale": "Schriftgröße",
  "App Language": "App-Sprache",
};
const german = (descriptor: MessageDescriptor) =>
  GERMAN[descriptor.message!] ?? descriptor.message!;

const ROWS = [
  row("density", "appearance", "Density", {
    values: [text("Comfortable"), text("Compact")],
  }),
  row("font-scale", "appearance", "Font scale"),
  row("app-language", "language", "App Language", { values: ["Deutsch", "English"] }),
];

const hits = (rows: readonly SearchableRow[], search: string, translate = english) =>
  searchHits(searchedRows(rows, translate), search);

const ids = (groups: readonly HitGroup<SearchableRow>[] | undefined) =>
  groups?.map((group) => [group.view, ...group.rows.map((found) => found.id)]);

test("a row is found by its title, whatever the case and the space around the text", () => {
  expect(ids(hits(ROWS, "  DENS "))).toEqual([["appearance", "density"]]);
});

test("a match at the start of a word stands before a match inside a word", () => {
  const rows = [
    row("font-scale", "appearance", "Font scale"),
    row("alignment", "appearance", "Alignment"),
  ];
  expect(ids(hits(rows, "al"))).toEqual([["appearance", "alignment", "font-scale"]]);
});

test("equal matches keep the order of the list", () => {
  const rows = [
    row("theme-light", "appearance", "Theme for light"),
    row("theme-dark", "appearance", "Theme for dark"),
  ];
  expect(ids(hits(rows, "theme"))).toEqual([["appearance", "theme-light", "theme-dark"]]);
});

test("the name of a value finds its row", () => {
  expect(ids(hits(ROWS, "compact"))).toEqual([["appearance", "density"]]);
});

test("a value that is the same in every language finds its row", () => {
  expect(ids(hits(ROWS, "deutsch", german))).toEqual([["language", "app-language"]]);
  expect(ids(hits(ROWS, "deutsch", english))).toEqual([["language", "app-language"]]);
});

test("the description and the search words find a row", () => {
  const rows = [
    row("density", "appearance", "Density", {
      description: text("How tightly lists are laid out."),
      searchWords: [text("Spacing")],
    }),
  ];
  expect(ids(hits(rows, "tightly"))).toEqual([["appearance", "density"]]);
  expect(ids(hits(rows, "spac"))).toEqual([["appearance", "density"]]);
});

test("the search runs in the language shown", () => {
  expect(ids(hits(ROWS, "kompakt", german))).toEqual([["appearance", "density"]]);
  expect(ids(hits(ROWS, "schriftgr", german))).toEqual([["appearance", "font-scale"]]);
  expect(ids(hits(ROWS, "compact", german))).toEqual([]);
  expect(ids(hits(ROWS, "kompakt", english))).toEqual([]);
});

test("the hits of several Views are grouped by View, the View of the best match first", () => {
  const rows = [
    row("density", "appearance", "Density", { searchWords: [text("Relaxed")] }),
    row("font-scale", "appearance", "Font scale", { searchWords: [text("Enlarge")] }),
    row("app-language", "language", "App Language"),
    row("license", "about", "License"),
  ];
  // "la" starts "Language" and stands inside "Relaxed" and "Enlarge".
  expect(ids(hits(rows, "la"))).toEqual([
    ["language", "app-language"],
    ["appearance", "density", "font-scale"],
  ]);
});

test("a text that matches nothing finds nothing, and neither does a typo", () => {
  expect(hits(ROWS, "invoice")).toEqual([]);
  expect(hits(ROWS, "densty")).toEqual([]);
});

test("a match does not span two parts of a row", () => {
  expect(hits([row("density", "appearance", "Density", { values: ["Compact"] })], "y c")).toEqual(
    [],
  );
});

test("without a text there is nothing to search for", () => {
  expect(hits(ROWS, "")).toBeUndefined();
  expect(hits(ROWS, "   ")).toBeUndefined();
});
