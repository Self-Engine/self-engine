import { expect, test } from "vite-plus/test";
import { lintFixtures } from "../testing/lint-fixture.ts";

test("foreign row maps are private while released read pieces and contract ids may be imported", () => {
  const results = lintFixtures("no-foreign-row-map", [
    'import { notesRowMap } from "@self-engine/notes/data";',
    'import { notesRowMap as rows } from "@self-engine/notes/data";',
    'export { notesRowMap } from "@self-engine/notes/data";',
    'import * as notes from "@self-engine/notes/data";',
    'import { notesRowMap } from "../../notes-module/data/rows.ts";',
    'import { noteTitles } from "@self-engine/notes/data";',
    'import { noteTitles } from "../../notes-module/data/index.ts";',
    'import { noteIdSchema } from "@self-engine/notes/contracts";',
    'import { notesRowMap } from "./rows.ts";',
    'import * as clock from "@self-engine/time";',
    'import type { RowMap } from "@self-engine/storage";',
    'import type { RowMap } from "@self-engine/db/schema";',
    'export type { RowMap } from "@self-engine/db/schema";',
    'import type { RowMap } from "@self-engine/data-protocol";',
    'export * from "@self-engine/notes/data";',
    'export { noteTitles } from "@self-engine/notes/data";',
    'const load = () => import("@self-engine/notes/data");',
  ]);
  expect(results.map((result) => result.length)).toEqual([
    1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1,
  ]);
  expect(results[0]?.[0]).toContain("released read piece");
});

test("a foreign module value cannot reveal its row map, including through typeof", () => {
  const results = lintFixtures("no-foreign-row-map", [
    'import { notes } from "@self-engine/notes/data"; const rows = notes.rowMap;',
    'import { notes as foreign } from "@self-engine/notes/data"; type Rows = typeof foreign.rowMap;',
    'import { notes } from "@self-engine/notes/data"; const rows = notes["rowMap"];',
    'import { notes } from "./index.ts"; type Rows = typeof notes.rowMap;',
    "const notes = { rowMap: {} }; const rows = notes.rowMap;",
    'import { notes } from "@self-engine/notes/data"; function local(notes: { rowMap: string }) { return notes.rowMap; }',
    'import { notes } from "@self-engine/notes/data"; const { rowMap } = notes;',
    'import { notes } from "@self-engine/notes/data"; const { rowMap: rows } = notes;',
    'import { notes } from "@self-engine/notes/data"; function local(notes: { rowMap: string }) { const { rowMap } = notes; return rowMap; }',
  ]);
  expect(results.map((result) => result.length)).toEqual([1, 1, 1, 0, 0, 0, 1, 1, 0]);
});

test("the Settings Port may use its row map from the migration package", () => {
  const source = 'import { settingsRowMap } from "@self-engine/settings-rows";';
  const results = lintFixtures("no-foreign-row-map", [
    { path: "packages/settings-data/src/data/settings.ts", source },
    { path: "packages/projects/src/data/projects.ts", source },
    {
      path: "packages/settings-data/src/data/foreign.ts",
      source: 'import { notesRowMap } from "@self-engine/notes/data";',
    },
  ]);

  expect(results.map((result) => result.length)).toEqual([0, 1, 1]);
});
