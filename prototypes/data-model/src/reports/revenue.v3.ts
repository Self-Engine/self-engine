import type { DB } from "../shared/db.ts";
import type { RevenueRow } from "./types.ts";

// #region report
const sql = `select p.id as project_id, p.name as project_name, strftime('%Y', t.start_at / 1000, 'unixepoch') as year,
    sum(t.end_at - t.start_at) / 3600000.0 as hours, sum(t.end_at - t.start_at) / 3600000.0 * p.hourly_rate as revenue
  from rm_time_entry t join rm_project p on p.id = t.project_id
  where t.end_at is not null
  group by p.id, year order by p.id, year`;
export const revenueReport = (db: DB) => db.prepare(sql).all() as RevenueRow[];
// #endregion
export { sql };
