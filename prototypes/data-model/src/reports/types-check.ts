/**
 * Compile-time check (run `bun run typecheck`): row types of the projections are generated from the
 * module declarations. A typed query builder (e.g. Kysely) could take these as its table types for
 * V3 (rm_<type>) and for the V2 views (v_<type>). V1 would need codegen from the DDL instead.
 */
import type { ModuleData, ProjectionRow } from "../shared/modules.ts";
import { genCol } from "../shared/modules.ts";

export const row: ProjectionRow<"time_entry"> = { id: "te_1", project_id: "prj_1", start_at: 0, end_at: null };
export const data: ModuleData<"time_entry"> = { projectId: "prj_1", startAt: 0, endAt: null };
export const col: "time_entry__start_at" = genCol("time_entry", "startAt");

// @ts-expect-error — not a projected field of time_entry
genCol("time_entry", "note");
// @ts-expect-error — wrong column name
export const bad: ProjectionRow<"time_entry"> = { id: "x", projectId: "p", start_at: 0, end_at: 0 };
