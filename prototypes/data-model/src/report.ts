/**
 * Renders Markdown from every run in `.temp/runs/*.json`: each number is the median over the runs
 * (each run's number is itself a median over `runs` repetitions), with min–max over runs where
 * the spread matters. Usage: node src/report.ts > .temp/report.md
 */
import { readdirSync, readFileSync } from "node:fs";
import { queryNames } from "./shared/variant.ts";
import { median } from "./shared/timing.ts";

const dir = new URL("../.temp/runs/", import.meta.url).pathname;
const runs = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(dir + f, "utf8")) as Record<string, any>);
if (runs.length === 0) throw new Error("no runs in .temp/runs");

const V = ["V1", "V2", "V3"] as const;
const scales = Object.keys(runs[0]!).filter((k) => /^\d+$/.test(k));

const at = (o: any, path: string[]) => path.reduce((x, k) => (x == null ? undefined : x[k]), o);
function values(path: string[]): number[] {
  return runs.map((r) => at(r, path)).filter((x): x is number => typeof x === "number");
}
const f = (ms: number) => (ms < 1 ? ms.toFixed(2) : ms < 10 ? ms.toFixed(1) : ms.toFixed(0));
function cell(path: string[], spread = false): string {
  const xs = values(path);
  if (xs.length === 0) return "–";
  const m = f(median(xs));
  return spread && xs.length > 1 ? `${m} <sub>(${f(Math.min(...xs))}–${f(Math.max(...xs))})</sub>` : m;
}

const env = runs.map((r) => r.env);
console.log(`# Messwerte (${runs.length} Läufe)\n`);
console.log("| Lauf | Datum | Node | SQLite | better-sqlite3 | CPU | Load avg Start → Ende |\n|---|---|---|---|---|---|---|");
env.forEach((e, i) =>
  console.log(`| ${i + 1} | ${e.date} | ${e.node} | ${e.sqlite} | ${e.betterSqlite3} | ${e.cpu}, ${e.cores} Kerne, ${e.memGiB} GiB | ${e.loadAvgAtStart?.join(" ")} → ${e.loadAvgAtEnd?.join(" ")} |`),
);
console.log(`\nWiederholungen je Abfrage: ${env[0].runs}, Timer-Stopps je Lauf: ${env[0].stops}. Zellen: Median über die Läufe, klein: min–max über die Läufe.`);

for (const scale of scales) {
  const base = [scale, "variants"];
  const counts = runs[0]![scale].counts as Record<string, number>;
  console.log(`\n## ${Number(scale).toLocaleString("de-DE")} Zeiteinträge\n`);
  console.log(`Objekte: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")}; Brücken-Links ${runs[0]![scale].bridges}.\n`);
  const table = (title: string, rows: [string, string[], boolean?][]) => {
    console.log(`\n### ${title}\n\n| | V1 | V2 | V3 |\n|---|---|---|---|`);
    for (const [label, path, spread] of rows) console.log(`| ${label} | ${V.map((v) => cell([...base, v, ...path], spread ?? true)).join(" | ")} |`);
  };
  table(
    "Abfragen (ms, Median)",
    queryNames.flatMap((q) => [
      [`${q} — ohne ANALYZE`, ["noAnalyze", q, "medianMs"]] as [string, string[]],
      [`${q} — mit ANALYZE`, ["withAnalyze", q, "medianMs"]] as [string, string[]],
    ]).concat([
      ["customer — mit Ausdrucks-Index", ["customerIndexed", "medianMs"]],
      ["hoursAll über View v_time_entry — ohne ANALYZE", ["noAnalyze", "hoursAll (view)", "medianMs"]],
      ["hoursAll über View v_time_entry — mit ANALYZE", ["withAnalyze", "hoursAll (view)", "medianMs"]],
      ["hoursYear über View — ohne ANALYZE", ["noAnalyze", "hoursYear (view)", "medianMs"]],
      ["hoursYear über View — mit ANALYZE", ["withAnalyze", "hoursYear (view)", "medianMs"]],
      ["Report Umsatz/Projekt/Jahr (mit ANALYZE)", ["report", "medianMs"]],
      ["hoursAll nach Rebuild + ANALYZE", ["afterRebuildHoursAll", "medianMs"]],
    ]),
  );
  table("Schreiben (ms)", [
    ["Timer-Stopp (Rundung, zod, Overlap, Projektion, Op-Log) — Median", ["writes", "medianMs"]],
    ["Timer-Stopp — p95", ["writes", "p95Ms"]],
    ["Timer-Start — Median", ["writes", "startMedianMs"]],
    ["Import kompletter Datensatz (eine Transaktion)", ["importMs"]],
    ["ANALYZE", ["analyzeMs"]],
  ]);
  const keyRows = (field: string) => {
    const keys = new Set<string>();
    for (const v of V) for (const k of Object.keys(at(runs[0], [...base, v, field]) ?? {})) keys.add(`${v}\u0000${k}`);
    return [...keys].map((vk) => {
      const [v, k] = vk.split("\u0000") as [string, string];
      return `| ${v} | ${k} | ${cell([...base, v, field, k], true)} |`;
    });
  };
  console.log(`\n### Wartung (ms)\n\n| Variante | Schritt | ms |\n|---|---|---|`);
  for (const field of ["rebuild", "moduleField", "customField"]) console.log(keyRows(field).map((l) => l.replace(/^\| (V\d) \| /, `| $1 | ${field}: `)).join("\n"));
  console.log(`\n### Größe (MiB)\n\n| | V1 | V2 | V3 |\n|---|---|---|---|`);
  for (const [label, key] of [["DB-Datei nach Import + Checkpoint", "sizeBytes"], ["nach allen Schritten (Indizes, Felder, Timer)", "sizeAfterAllBytes"]]) {
    console.log(`| ${label} | ${V.map((v) => (median(values([...base, v, key!])) / 2 ** 20).toFixed(1)).join(" | ")} |`);
  }
  console.log(`\n### Kontrollsummen (Lauf 1, müssen je Zeile gleich sein)\n\n| Abfrage | V1 | V2 | V3 |\n|---|---|---|---|`);
  for (const q of queryNames) console.log(`| ${q} | ${V.map((v) => at(runs[0], [...base, v, "withAnalyze", q, "checksum"])).join(" | ")} |`);
  console.log(`| report | ${V.map((v) => at(runs[0], [...base, v, "report", "checksum"])).join(" | ")} |`);
  console.log(`\n### Query-Pläne (Lauf 1)\n`);
  for (const v of V) {
    console.log(`\n**${v}**\n`);
    const x = at(runs[0], [...base, v]);
    for (const q of Object.keys(x.withAnalyze)) {
      const a = x.noAnalyze[q].plan;
      const b = x.withAnalyze[q].plan;
      console.log(`- \`${q}\`: ${a === b ? b : `ohne ANALYZE: ${a} → **mit:** ${b}`}`);
    }
    console.log(`- \`report\`: ${x.report.plan}`);
    console.log(`- \`customer (Index)\`: ${x.customerIndexed.plan}`);
  }
}

if (runs[0]!.bulkImport50k) {
  console.log(`\n## Import von 50 000 Zeiteinträgen in eine DB mit nur Projekten (ms)\n\n| Pfad | ms |\n|---|---|`);
  for (const k of Object.keys(runs[0]!.bulkImport50k)) console.log(`| ${k} | ${cell(["bulkImport50k", k], true)} |`);
}
