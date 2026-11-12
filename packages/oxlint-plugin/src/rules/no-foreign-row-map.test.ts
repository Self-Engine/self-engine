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
    'export * from "@self-engine/notes/data";',
    'export { noteTitles } from "@self-engine/notes/data";',
    'const load = () => import("@self-engine/notes/data");',
  ]);
  expect(results.map((result) => result.length)).toEqual([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 1]);
  expect(results[0]?.[0]).toContain("released read piece");
});
