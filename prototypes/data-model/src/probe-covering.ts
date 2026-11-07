/**
 * Probe: does SQLite use an index on generated columns as a covering index?
 * Prints the query plan for plain columns vs VIRTUAL vs STORED generated columns.
 * Usage: node src/probe-covering.ts
 */
import Database from "better-sqlite3";

const q = "select p, sum(e - s) from t where type = 'te' and deleted = 0 group by p";
for (const mode of ["plain", "virtual", "stored"] as const) {
  const db = new Database(":memory:");
  const cols =
    mode === "plain"
      ? "s integer, e integer, p text"
      : `s integer as (data ->> '$.s') ${mode}, e integer as (data ->> '$.e') ${mode}, p text as (data ->> '$.p') ${mode}`;
  db.exec(`create table t(id text primary key, type text not null, data blob not null, deleted integer not null default 0, ${cols})`);
  const ins =
    mode === "plain"
      ? db.prepare("insert into t(id, type, data, s, e, p) values (?, ?, jsonb('{}'), ?, ?, ?)")
      : db.prepare("insert into t(id, type, data) values (?, ?, jsonb(?))");
  db.transaction(() => {
    for (let i = 0; i < 20_000; i++) {
      const type = i % 2 ? "te" : "other";
      if (mode === "plain") ins.run(`x${i}`, type, i, i + 5, `p${i % 30}`);
      else ins.run(`x${i}`, type, JSON.stringify({ s: i, e: i + 5, p: `p${i % 30}` }));
    }
  })();
  for (const ix of ["(p, s, e)", "(p, s, e, type, deleted)"]) {
    db.exec(`create index a on t${ix} where type = 'te' and deleted = 0; analyze`);
    const plan = (db.prepare(`explain query plan ${q}`).all() as { detail: string }[]).map((r) => r.detail).join(" | ");
    console.log(`${mode.padEnd(8)} index ${ix.padEnd(26)} -> ${plan}`);
    db.exec("drop index a");
  }
  if (mode === "plain") console.log("sqlite", (db.prepare("select sqlite_version() v").get() as { v: string }).v);
}
