import type { TablesOf } from "@self-engine/db";
import type { TableNames } from "@self-engine/shell";
import type { SyncedTable } from "@self-engine/storage";
import { expectTypeOf, test } from "vite-plus/test";
import type { projectsRowMap } from "./data/rows.ts";
import type { contribution } from "./index.ts";

test("the Shell Contribution must name every synced table of its Row Map", () => {
  type Rows = typeof projectsRowMap;
  type Names = TableNames<
    SyncedTable<TablesOf<Rows & { project_links: Rows["projects"]; local_cache: Rows["projects"] }>>
  >;
  expectTypeOf<keyof Names>().toEqualTypeOf<"projects" | "project_links">();

  type Contribution = Pick<typeof contribution, "tableNames">;
  expectTypeOf<Contribution>().toExtend<{ readonly tableNames: Pick<Names, "projects"> }>();
  // @ts-expect-error Adding a synced table requires a name for it in the module's contribution.
  expectTypeOf<Contribution>().toExtend<{ readonly tableNames: Names }>();
});
