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
    'export * from "@self-engine/notes/data";',
    'export { noteTitles } from "@self-engine/notes/data";',
    'const load = () => import("@self-engine/notes/data");',
  ]);
  expect(results.map((result) => result.length)).toEqual([
    1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1,
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
  ]);
  expect(results.map((result) => result.length)).toEqual([1, 1, 1, 0, 0, 0]);
});
