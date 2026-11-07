import { Database } from "bun:sqlite";
const N = 50_000, P = 40, NOISE = 150_000; // NOISE = other objects in same table
function rnd(seed: number) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; }
const r = rnd(42);
const db = new Database(":memory:");
console.log("sqlite", db.query("select sqlite_version() v").get());
db.exec(`
create table objects(id text primary key, space_id text not null, type text not null, fields blob not null, schema_version int not null default 1, deleted int not null default 0);
create table links(from_id text not null, to_id text not null, kind text not null, primary key(from_id, kind, to_id));
create index links_to on links(to_id, kind);
create table time_entries(id text primary key, project_id text not null, start_at int not null, end_at int not null, extra text);
`);
const ins = db.prepare("insert into objects(id,space_id,type,fields) values (?,?,?,jsonb(?))");
const insL = db.prepare("insert into links values (?,?,?)");
const insT = db.prepare("insert into time_entries values (?,?,?,?,?)");
const base = Date.UTC(2022,0,1);
db.transaction(() => {
  for (let p = 0; p < P; p++) ins.run("p"+p, "s1", "project", JSON.stringify({ name: "Project "+p }));
  for (let i = 0; i < N; i++) {
    const pid = "p" + Math.floor(r()*P);
    const start = base + Math.floor(r()*4*365*86400e3);
    const end = start + Math.floor((0.25 + r()*6) * 3600e3);
    ins.run("t"+i, "s1", "time_entry", JSON.stringify({ projectId: pid, startAt: start, endAt: end, note: "x".repeat(40), custom: { billable: r()>0.5 } }));
    insL.run("t"+i, pid, "time_entry.project");
    insT.run("t"+i, pid, start, end, null);
  }
  for (let i = 0; i < NOISE; i++) ins.run("n"+i, "s1", ["task","habit_log","cashflow"][i%3], JSON.stringify({ title: "n"+i, startAt: base, amount: 3 }));
})();
const month = (col: string) => `strftime('%Y-%m', ${col}/1000, 'unixepoch')`;
function bench(label: string, sql: string, runs = 20) {
  const q = db.query(sql); q.all(); const t0 = performance.now();
  let rows = 0; for (let i = 0; i < runs; i++) rows = q.all().length;
  console.log(label.padEnd(58), ((performance.now()-t0)/runs).toFixed(2), "ms  rows", rows);
}
const year = `and start between ${Date.UTC(2024,0,1)} and ${Date.UTC(2025,0,1)}`;
// A: typed table
bench("A typed table, all months", `select project_id, ${month("start_at")} m, sum(end_at-start_at)/3.6e6 h from time_entries group by 1,2`);
bench("A typed table, one year", `select project_id, ${month("start_at")} m, sum(end_at-start_at)/3.6e6 h from time_entries where start_at between ${Date.UTC(2024,0,1)} and ${Date.UTC(2025,0,1)} group by 1,2`);
// B: JSON without index
const jb = `select fields->>'$.projectId' pid, ${month("(fields->>'$.startAt')")} m, sum((fields->>'$.endAt')-(fields->>'$.startAt'))/3.6e6 h from objects where type='time_entry'`;
bench("B JSONB, no type index, all months", jb + " group by 1,2");
db.exec("create index objects_type on objects(type, deleted)");
bench("B JSONB + index(type), all months", jb + " group by 1,2");
db.exec(`create index obj_te on objects(type, fields->>'$.startAt') where type='time_entry'`);
bench("B JSONB + partial expr index, one year", `select fields->>'$.projectId' pid, ${month("(fields->>'$.startAt')")} m, sum((fields->>'$.endAt')-(fields->>'$.startAt'))/3.6e6 h from objects where type='time_entry' and fields->>'$.startAt' between ${Date.UTC(2024,0,1)} and ${Date.UTC(2025,0,1)} group by 1,2`);
// C: generated virtual columns + covering index
db.exec(`alter table objects add column g_start int as (fields->>'$.startAt');
alter table objects add column g_end int as (fields->>'$.endAt');
alter table objects add column g_ref1 text as (fields->>'$.projectId');
create index obj_gen on objects(type, g_start, g_end, g_ref1) where type='time_entry';`);
bench("C generated cols + covering partial index, all months", `select g_ref1, ${month("g_start")} m, sum(g_end-g_start)/3.6e6 h from objects where type='time_entry' group by 1,2`);
bench("C generated cols + covering partial index, one year", `select g_ref1, ${month("g_start")} m, sum(g_end-g_start)/3.6e6 h from objects where type='time_entry' and g_start between ${Date.UTC(2024,0,1)} and ${Date.UTC(2025,0,1)} group by 1,2`);
db.exec("analyze"); bench("C after ANALYZE, all months", `select g_ref1, ${month("g_start")} m, sum(g_end-g_start)/3.6e6 h from objects where type='time_entry' group by 1,2`); bench("C INDEXED BY obj_gen, all months", `select g_ref1, ${month("g_start")} m, sum(g_end-g_start)/3.6e6 h from objects indexed by obj_gen where type='time_entry' group by 1,2`);
console.log(db.query(`explain query plan select g_ref1, sum(g_end-g_start) from objects where type='time_entry' and g_start between 1 and 2 group by 1`).all().map((x:any)=>x.detail));
// D: project via links table
bench("D JSONB times + links join for project, all months", `select l.to_id pid, ${month("(o.fields->>'$.startAt')")} m, sum((o.fields->>'$.endAt')-(o.fields->>'$.startAt'))/3.6e6 h from objects o join links l on l.from_id=o.id and l.kind='time_entry.project' where o.type='time_entry' group by 1,2`);
// E: rebuilt read table
let t0 = performance.now();
db.exec(`create table rm_time_entries as select id, g_ref1 project_id, g_start start_at, g_end end_at from objects where type='time_entry'; create index rm_te on rm_time_entries(start_at, project_id, end_at);`);
console.log("E rebuild read table (50k)".padEnd(58), (performance.now()-t0).toFixed(2), "ms");
bench("E read table, one year", `select project_id, ${month("start_at")} m, sum(end_at-start_at)/3.6e6 h from rm_time_entries where start_at between ${Date.UTC(2024,0,1)} and ${Date.UTC(2025,0,1)} group by 1,2`);
// single-row update cost
const up = db.prepare(`update objects set fields = jsonb_set(fields, '$.endAt', ?) where id = ?`);
t0 = performance.now(); db.transaction(()=>{ for (let i=0;i<5000;i++) up.run(base+i, "t"+i); })();
console.log("5000 jsonb_set updates (with gen-col index)".padEnd(58), (performance.now()-t0).toFixed(2), "ms");
