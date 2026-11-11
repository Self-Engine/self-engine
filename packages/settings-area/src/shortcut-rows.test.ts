import type { MessageDescriptor } from "@lingui/core";
import { expect, test } from "vite-plus/test";
import { searchedRows, searchHits } from "./search.ts";
import { type NamedCommandOwner, shortcutRows } from "./shortcut-rows.tsx";

const text = (message: string): MessageDescriptor => ({ id: message, message });
const english = (descriptor: MessageDescriptor) => descriptor.message!;
const load = () => Promise.reject(new Error("The rows never load a Command"));

const PROJECTS: NamedCommandOwner = {
  id: "projects",
  name: text("Projects"),
  commands: [
    { id: "create", kind: "page", label: text("New project"), defaultShortcut: "Mod+N", load },
    { id: "archive", kind: "open", label: text("Archive project"), load },
    { id: "import", kind: "input", load },
  ],
};
const HABITS: NamedCommandOwner = { id: "habits", name: text("Habits") };

const shown = (owners: readonly NamedCommandOwner[]) =>
  shortcutRows(owners).map((row) => [english(row.group!.heading), english(row.title)]);

test("the general Shortcuts come first: the Command Palette's, then the Shell's Commands", () => {
  expect(shown([])).toEqual([
    ["General", "Open the Command Palette"],
    ["General", "Undo"],
  ]);
});

test("a module's Commands with a default shortcut follow under its name, the others are left out", () => {
  expect(shown([PROJECTS, HABITS])).toEqual([
    ["General", "Open the Command Palette"],
    ["General", "Undo"],
    ["Projects", "New project"],
  ]);
});

test("every row belongs to the View Shortcuts and has its own id", () => {
  const rows = shortcutRows([PROJECTS]);
  expect(rows.map((row) => row.view)).toEqual(["shortcuts", "shortcuts", "shortcuts"]);
  expect(new Set(rows.map((row) => row.id)).size).toBe(3);
});

test("the search finds a Shortcut by the name of its Command", () => {
  const hits = searchHits(
    searchedRows(shortcutRows([PROJECTS]), { locale: "en", _: english }),
    "undo",
  );
  expect(hits?.map((group) => group.rows.map((row) => english(row.title)))).toEqual([["Undo"]]);
});
