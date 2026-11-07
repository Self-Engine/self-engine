/**
 * Runs all measurements for V1, V2, V3 once and writes `.temp/runs/<timestamp>.json`.
 * Usage: node src/bench.ts [--scales=50000,200000] [--runs=15] [--stops=300]
 * Render (median over all runs in .temp/runs): node src/report.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, totalmem, arch, platform, release, loadavg } from "node:os";
import { generate, HISTORY_END, HISTORY_START, type Dataset } from "./shared/data.ts";
import { fileSizeBytes, openFresh, sqliteVersion, type DB } from "./shared/db.ts";
import { median, percentile, rng, sample, time } from "./shared/timing.ts";
import { logOp, queryNames, startTimer, stopTimer, type QueryArgs, type QueryDef, type Variant } from "./shared/variant.ts";
import { v1 } from "./v1/v1.ts";
import { v2 } from "./v2/v2.ts";
import { v3 } from "./v3/v3.ts";
import * as mf1 from "./changes/module-field.v1.ts";
import * as mf2 from "./changes/module-field.v2.ts";
import * as mf3 from "./changes/module-field.v3.ts";
import * as cf1 from "./changes/custom-field.v1.ts";
import * as cfo from "./changes/custom-field.objects.ts";
import * as r1 from "./reports/revenue.v1.ts";
import * as r2 from "./reports/revenue.v2.ts";
import * as r3 from "./reports/revenue.v3.ts";

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const scales = arg("scales", "50000,200000").split(",").map(Number);
const RUNS = Number(arg("runs", "15"));
const STOPS = Number(arg("stops", "300"));
const variants: Variant[] = [v1, v2, v3];
const extras = {
  V1: { moduleField: mf1, customField: cf1, report: r1 },
  V2: { moduleField: mf2, customField: cfo, report: r2 },
  V3: { moduleField: mf3, customField: cfo, report: r3 },
} as const;

const TEMP = new URL("../.temp/", import.meta.url).pathname;
mkdirSync(TEMP, { recursive: true });

type QueryStat = { medianMs: number; p95Ms: number; checksum: string; plan: string };

/** Deterministic, varied arguments per run (overlap windows, projects, customers). */
function argsFor(ds: Dataset, i: number): QueryArgs {
  const r = rng(1000 + i);
  const start = HISTORY_START + Math.floor((r() * (HISTORY_END - HISTORY_START)) / 60_000) * 60_000;
  return {
    from: Date.UTC(2025, 0, 1),
    to: Date.UTC(2026, 0, 1),
    start,
    end: start + 3_600_000,
    projectId: ds.projectIds[Math.floor(r() * 20)]!, // the 20 busiest projects
    customer: ds.customers[Math.abs(i) % ds.customers.length]!,
  };
}

/** Stable fingerprint of a result so the variants can be compared for equality. */
function checksum(rows: Record<string, unknown>[]): string {
  let sum = 0;
  for (const row of rows) for (const v of Object.values(row)) if (typeof v === "number") sum += v;
  return `${rows.length} rows, Σnum=${sum.toFixed(2)}`;
}

function plan(db: DB, q: QueryDef, a: QueryArgs): string {
  return (db.prepare(`explain query plan ${q.sql}`).all(...q.params(a)) as { detail: string }[]).map((r) => r.detail).join(" | ");
}

function runQuery(db: DB, ds: Dataset, q: QueryDef, varied: boolean): QueryStat {
  const s = db.prepare(q.sql);
  const a0 = argsFor(ds, 0);
  const samples = sample((i) => s.all(...q.params(varied ? argsFor(ds, i) : a0)), RUNS);
  return {
    medianMs: median(samples),
    p95Ms: percentile(samples, 95),
    checksum: checksum(s.all(...q.params(a0)) as Record<string, unknown>[]),
    plan: plan(db, q, a0),
  };
}

function runQueries(db: DB, ds: Dataset, v: Variant): Record<string, QueryStat> {
  const out: Record<string, QueryStat> = {};
  for (const name of queryNames) out[name] = runQuery(db, ds, v.queries[name], name === "overlap" || name === "backlinks" || name === "customer");
  for (const [name, q] of Object.entries(v.extraQueries ?? {})) out[name] = runQuery(db, ds, q, false);
  return out;
}

function importAll(db: DB, v: Variant, ds: Dataset): void {
  db.transaction(() => {
    v.insertObjects(db, ds.objects);
    v.insertBridges(db, ds.bridges);
    logOp(db, "import", null, { objects: ds.objects.length, bridges: ds.bridges.length });
  })();
}

/** Bulk import of 50 000 time entries (validated, all derived structures) into a DB with only projects. */
function bulkImport50k(v: Variant, ds50k: Dataset, useBulkPath = false): number {
  const db = openFresh(`${TEMP}db/bulk-${v.name}.sqlite`);
  v.createSchema(db);
  const projects = ds50k.objects.filter((o) => o.type === "project");
  const entries = ds50k.objects.filter((o) => o.type === "time_entry").slice(0, 50_000);
  db.transaction(() => v.insertObjects(db, projects))();
  const ms = time(() =>
    db.transaction(() => {
      if (useBulkPath && v.bulkInsertObjects) v.bulkInsertObjects(db, entries);
      else v.insertObjects(db, entries);
      logOp(db, "import", null, { count: entries.length });
    })(),
  ).ms;
  db.close();
  return ms;
}

function timerStops(db: DB, v: Variant, ds: Dataset): { medianMs: number; p95Ms: number; startMedianMs: number } {
  const stops: number[] = [];
  const starts: number[] = [];
  const base = HISTORY_END + 86_400_000;
  const r = rng(7);
  for (let i = 0; i < STOPS + 5; i++) {
    const id = `timer_${i}`;
    const startAt = base + i * 2 * 3_600_000;
    const projectId = ds.projectIds[Math.floor(r() * ds.projectIds.length)]!;
    const t0 = performance.now();
    startTimer(db, v, id, projectId, startAt);
    const t1 = performance.now();
    const res = stopTimer(db, v, id, startAt + Math.floor((20 + r() * 80) * 60_000));
    const t2 = performance.now();
    if (res.overlaps !== 0) throw new Error("unexpected overlap");
    if (i >= 5) {
      starts.push(t1 - t0);
      stops.push(t2 - t1);
    }
  }
  return { medianMs: median(stops), p95Ms: percentile(stops, 95), startMedianMs: median(starts) };
}

const env = {
  date: new Date().toISOString(),
  node: process.version,
  sqlite: "",
  betterSqlite3: (await import("better-sqlite3/package.json", { with: { type: "json" } })).default.version,
  cpu: cpus()[0]?.model,
  cores: cpus().length,
  memGiB: Math.round(totalmem() / 2 ** 30),
  os: `${platform()} ${release()} ${arch()}`,
  runs: RUNS,
  stops: STOPS,
  loadAvgAtStart: loadavg().map((x) => Math.round(x * 10) / 10),
  loadAvgAtEnd: [] as number[],
};

const all: Record<string, unknown> = { env };
let ds50k: Dataset | undefined;

for (const scale of scales) {
  const ds = generate(scale);
  if (scale === 50_000) ds50k = ds;
  const counts: Record<string, number> = {};
  for (const o of ds.objects) counts[o.type] = (counts[o.type] ?? 0) + 1;
  console.error(`\n## scale ${scale}: ${ds.objects.length} objects, ${ds.bridges.length} bridge links`, counts);
  const perVariant: Record<string, unknown> = {};

  for (const v of variants) {
    const db = openFresh(`${TEMP}db/${v.name}-${scale}.sqlite`);
    env.sqlite = sqliteVersion(db);
    v.createSchema(db);
    const importMs = time(() => importAll(db, v, ds)).ms;
    const sizeBytes = fileSizeBytes(db);
    console.error(`${v.name}: import ${importMs.toFixed(0)} ms, ${(sizeBytes / 2 ** 20).toFixed(1)} MiB`);

    const noAnalyze = runQueries(db, ds, v);
    const analyzeMs = time(() => db.exec("analyze")).ms;
    const withAnalyze = runQueries(db, ds, v);

    v.createCustomerIndex(db);
    db.exec("analyze");
    const customerIndexed = runQuery(db, ds, v.queries.customer, true);

    const writes = timerStops(db, v, ds);
    const ex = extras[v.name];
    const reportStat = runQuery(db, ds, { sql: ex.report.sql, params: () => [] }, false);

    const rebuild = v.rebuild(db);
    db.exec("analyze");
    const afterRebuild = runQuery(db, ds, v.queries.hoursAll, false);

    const moduleField = ex.moduleField.apply(db);
    const customField = ex.customField.apply(db);
    const sizeAfterAllBytes = fileSizeBytes(db);
    db.close();

    perVariant[v.name] = {
      importMs, sizeBytes, sizeAfterAllBytes, analyzeMs, noAnalyze, withAnalyze, customerIndexed, writes,
      report: reportStat, rebuild, afterRebuildHoursAll: afterRebuild, moduleField, customField,
    };
    console.error(`${v.name}: done`);
  }
  all[String(scale)] = { counts, bridges: ds.bridges.length, variants: perVariant };
}

if (ds50k) {
  const bulk: Record<string, number> = {};
  for (const v of variants) {
    bulk[v.name] = bulkImport50k(v, ds50k);
    if (v.bulkInsertObjects) bulk[`${v.name} (bulk path: truth, then rebuild)`] = bulkImport50k(v, ds50k, true);
  }
  all["bulkImport50k"] = bulk;
  console.error("bulk import 50k", bulk);
}
env.loadAvgAtEnd = loadavg().map((x) => Math.round(x * 10) / 10);

const runFile = `${TEMP}runs/${env.date.replace(/[:.]/g, "-")}.json`;
mkdirSync(`${TEMP}runs`, { recursive: true });
writeFileSync(runFile, JSON.stringify(all, null, 2));
console.error(`wrote ${runFile} — render with: node src/report.ts`);
