// Builds the plan overview page (docs/agents/workflow.md, D155, D156) from GitHub and
// docs/plan/roadmap.json into .temp/plan-overview.html. It only writes that file; the agent
// publishes it. The whole page is regenerated each time, so a step someone forgot corrects itself.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const REPO = "GwydionBr/self-engine-next";
const OUTPUT = ".temp/plan-overview.html";
const ROADMAP = "docs/plan/roadmap.json";
const BUILD_LABELS = ["ready-for-agent", "ready-for-human", "needs-grilling"];

export interface Issue {
  readonly number: number;
  readonly title: string;
  readonly state: "OPEN" | "CLOSED";
  /** Why a closed issue was closed; only `COMPLETED` means the work was built. */
  readonly stateReason?: string;
  readonly labels: readonly string[];
  readonly body: string;
}

export interface RoadmapLayer {
  /** The `n` of the `layer:<n>` label, or a free key for work that has no layer yet. */
  readonly id: string;
  readonly name: string;
  readonly decisions?: string;
  /** Shown while the layer has no issues. */
  readonly planned?: readonly { readonly title: string; readonly note?: string }[];
}

export interface Roadmap {
  readonly layers: readonly RoadmapLayer[];
}

export type Status =
  | "built"
  | "review"
  | "cut"
  | "specified"
  | "grill"
  | "buildable"
  | "triage"
  | "planned";

type Step = "done" | "active" | "open" | "none";

export interface Row {
  readonly number?: number;
  readonly title: string;
  readonly status: Status;
  readonly steps: readonly Step[];
  readonly slices: readonly { readonly number: number; readonly status: Status }[];
  /** Open blockers; undefined for finished work and for rows without an issue. */
  readonly waitingOn?: readonly number[];
  readonly note?: string;
}

export interface LayerView {
  readonly id: string;
  readonly name: string;
  readonly decisions?: string;
  readonly specNumber?: number;
  readonly rows: readonly Row[];
  readonly built: number;
  readonly total: number;
}

export interface Overview {
  readonly layers: readonly LayerView[];
  readonly counts: Readonly<Record<Status, number>>;
  readonly total: number;
  readonly nextSteps: readonly string[];
}

/** The issue a `## Parent` section names, if it has one. */
export function parentOf(body: string): number | undefined {
  const match = /^## Parent\s+#(\d+)/mu.exec(body);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** The issues named in a `Blocked by:` line or a `## Blocked by` section. */
export function blockersOf(body: string): number[] {
  const text =
    /^Blocked by:(.*)$/imu.exec(body)?.[1] ??
    /^## Blocked by\s*\n((?:[ \t]*-.*(?:\n|$))+)/imu.exec(body)?.[1] ??
    "";
  return [...text.matchAll(/#(\d+)/gu)].map((match) => Number(match[1]));
}

/** The status of a ticket, read from GitHub in the order docs/agents/workflow.md states. */
export function statusOf(
  issue: Issue,
  context: { readonly hasOpenPullRequest: boolean; readonly hasChildren: boolean },
): Status {
  if (issue.state === "CLOSED") return "built";
  if (context.hasOpenPullRequest) return "review";
  if (context.hasChildren) return "cut";
  if (hasSpec(issue)) return "specified";
  if (issue.labels.includes("needs-grilling")) return "grill";
  if (issue.labels.includes("ready-for-agent")) return "buildable";
  return "triage";
}

function hasSpec(issue: Issue): boolean {
  return /Problem Statement/u.test(issue.body);
}

function stepsOf(status: Status, specified: boolean): Step[] {
  const spec: Step = specified ? "done" : "none";
  switch (status) {
    case "built":
      return ["done", spec, "done", "done"];
    case "review":
      return ["done", spec, "done", "active"];
    case "cut":
      return ["done", "done", "done", "open"];
    case "specified":
      return ["done", "done", "open", "open"];
    case "grill":
      return ["done", "open", "open", "open"];
    case "buildable":
      return ["done", "none", "done", "open"];
    case "triage":
    case "planned":
      return ["open", "open", "open", "open"];
  }
}

export function buildOverview(
  issues: readonly Issue[],
  closedByOpenPullRequests: ReadonlyMap<number, number>,
  roadmap: Roadmap,
): Overview {
  // A superseded or rejected issue was never built, so it counts nowhere.
  const sorted = issues
    .filter((issue) => issue.state === "OPEN" || issue.stateReason !== "NOT_PLANNED" && issue.stateReason !== "DUPLICATE")
    .sort((a, b) => a.number - b.number);
  const byNumber = new Map(sorted.map((issue) => [issue.number, issue]));
  const childrenOf = new Map<number, Issue[]>();
  for (const issue of sorted) {
    const parent = parentOf(issue.body);
    if (parent !== undefined) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), issue]);
  }
  const status = (issue: Issue): Status =>
    statusOf(issue, {
      hasOpenPullRequest: closedByOpenPullRequests.has(issue.number),
      hasChildren: childrenOf.has(issue.number),
    });
  // A layer spec holds packages as children and is itself nothing an agent could build.
  const isLayerSpec = (issue: Issue): boolean =>
    childrenOf.has(issue.number) && !issue.labels.some((label) => BUILD_LABELS.includes(label));
  const isSlice = (issue: Issue): boolean => {
    const parent = byNumber.get(parentOf(issue.body) ?? Number.NaN);
    return parent !== undefined && !isLayerSpec(parent);
  };

  const rowOf = (issue: Issue): Row => {
    const current = status(issue);
    const open = blockersOf(issue.body).filter((n) => byNumber.get(n)?.state === "OPEN");
    return {
      number: issue.number,
      title: issue.title,
      status: current,
      steps: stepsOf(current, hasSpec(issue)),
      slices: (childrenOf.get(issue.number) ?? []).map((child) => ({
        number: child.number,
        status: status(child),
      })),
      ...(current === "built" ? {} : { waitingOn: open }),
    };
  };

  const layerIdOf = (issue: Issue): string | undefined =>
    issue.labels.find((label) => label.startsWith("layer:"))?.slice("layer:".length);
  const packages = sorted.filter((issue) => !isSlice(issue) && !isLayerSpec(issue));

  const known = new Set(roadmap.layers.map((layer) => layer.id));
  const unassigned = packages.filter((issue) => !known.has(layerIdOf(issue) ?? ""));
  const views = [
    ...roadmap.layers,
    ...(unassigned.length > 0 ? [{ id: "none", name: "Noch nicht eingestuft" }] : []),
  ].map((layer): LayerView => {
    const members =
      layer.id === "none"
        ? unassigned
        : packages.filter((issue) => layerIdOf(issue) === layer.id);
    const rows: Row[] =
      members.length > 0
        ? members.map(rowOf)
        : (layer.planned ?? []).map((item) => ({
            title: item.title,
            status: "planned" as const,
            steps: stepsOf("planned", false),
            slices: [],
            ...(item.note === undefined ? {} : { note: item.note }),
          }));
    const counted = members.flatMap((issue) => [issue, ...(childrenOf.get(issue.number) ?? [])]);
    const spec = sorted.find((issue) => isLayerSpec(issue) && layerIdOf(issue) === layer.id);
    return {
      id: layer.id,
      name: layer.name,
      ...("decisions" in layer && layer.decisions !== undefined
        ? { decisions: layer.decisions }
        : {}),
      ...(spec === undefined ? {} : { specNumber: spec.number }),
      rows,
      built: counted.filter((issue) => issue.state === "CLOSED").length,
      total: counted.length,
    };
  });

  const counts: Record<Status, number> = {
    built: 0,
    review: 0,
    cut: 0,
    specified: 0,
    grill: 0,
    buildable: 0,
    triage: 0,
    planned: 0,
  };
  for (const issue of sorted) counts[status(issue)] += 1;

  const openBlockers = (issue: Issue): boolean =>
    blockersOf(issue.body).some((n) => byNumber.get(n)?.state === "OPEN");
  const lowest = (wanted: Status, needsFree: boolean): Issue | undefined =>
    packages.find(
      (issue) => status(issue) === wanted && !(needsFree && openBlockers(issue)),
    );
  const pullRequests = [...new Set(closedByOpenPullRequests.values())].sort((a, b) => a - b);
  const toSlice = lowest("specified", false);
  const toGrill = lowest("grill", false);
  const toBuild = lowest("buildable", true);
  const nextSteps = [
    ...pullRequests.map(
      (n) => `<a class="num" href="https://github.com/${REPO}/pull/${n}">PR #${n}</a> prüfen und mergen.`,
    ),
    ...(toSlice === undefined ? [] : [`Teil-Tickets schneiden: ${describe(toSlice)}.`]),
    ...(toGrill === undefined ? [] : [`Nächstes Grilling: ${describe(toGrill)}.`]),
    ...(toBuild === undefined ? [] : [`Baubar ohne Blocker: ${describe(toBuild)}.`]),
  ];

  return { layers: views, counts, total: sorted.length, nextSteps };
}

function describe(issue: Issue): string {
  return `${issueLink(issue.number)} ${inline(issue.title)}`;
}

function issueLink(number: number): string {
  return `<a class="num" href="https://github.com/${REPO}/issues/${number}">#${number}</a>`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/gu, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return entities[character] ?? character;
  });
}

function inline(text: string): string {
  return escapeHtml(text).replace(/`([^`]+)`/gu, '<span class="num">$1</span>');
}

const STATUS_LABELS: Readonly<Record<Status, string>> = {
  built: "Gebaut",
  review: "Im Review",
  cut: "Geschnitten",
  specified: "Spezifiziert",
  grill: "Grilling nötig",
  buildable: "Baubar",
  triage: "Triage offen",
  planned: "Noch keine Issues",
};
const STEP_NAMES = ["Entschieden", "Grilling + Spec", "Tickets", "Gebaut"];
const STEP_STATES: Readonly<Record<Step, string>> = {
  done: "fertig",
  active: "läuft",
  open: "offen",
  none: "entfällt",
};
const FILTERS: readonly (readonly [string, string])[] = [
  ["all", "Alle"],
  ["open", "Noch offen"],
  ["grill", "Grilling nötig"],
  ["cut specified", "Spezifiziert"],
  ["buildable", "Baubar"],
  ["built", "Gebaut"],
];

function renderRow(row: Row): string {
  const id =
    row.number === undefined ? '<span class="num">–</span>' : issueLink(row.number);
  const steps = row.steps
    .map((step) => `<span class="n ${step}"></span>`)
    .join("");
  const label = row.steps
    .map((step, index) => `${STEP_NAMES[index] ?? ""}: ${STEP_STATES[step]}`)
    .join(", ");
  const slices = row.slices
    .map(
      (slice) =>
        `<a class="kid ${slice.status === "built" || slice.status === "review" ? slice.status : "todo"}" href="https://github.com/${REPO}/issues/${slice.number}" title="#${slice.number}" aria-label="Issue ${slice.number}"></a>`,
    )
    .join("");
  const waiting =
    row.waitingOn === undefined
      ? ""
      : row.waitingOn.length === 0
        ? '<span class="free">Keine Blocker</span>'
        : `<span class="muted">Wartet auf ${row.waitingOn.map((n) => `#${n}`).join(", ")}</span>`;
  const note = row.note === undefined ? "" : `<span class="muted">${inline(row.note)}</span>`;
  return `<div class="row" data-s="${row.status}">
  <div class="ttl">${id}<span>${inline(row.title)}</span></div>
  <div class="pipe" role="img" aria-label="${label}">${steps}</div>
  <div class="kids">${slices}</div>
  <div class="st"><span class="chip ${row.status}">${STATUS_LABELS[row.status]}</span>${waiting}${note}</div>
</div>`;
}

function renderLayer(layer: LayerView): string {
  const meta = [
    layer.decisions,
    layer.specNumber === undefined ? undefined : `Spec ${issueLink(layer.specNumber)}`,
    layer.total === 0 ? undefined : `${layer.built} von ${layer.total} gebaut`,
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
  return `<section class="layer" data-layer>
  <div class="lhead"><h2>${inline(layer.name)}</h2><span class="muted">${meta}</span></div>
  <div class="scroll"><div class="grid">
    <div class="row th"><div>Arbeitspaket</div><div class="heads"><span>Ent-<br>schieden</span><span>Grilling<br>+ Spec</span><span>Tickets</span><span>Gebaut</span></div><div>Teil-Tickets</div><div>Status</div></div>
    ${layer.rows.map(renderRow).join("\n")}
  </div></div>
</section>`;
}

function renderStop(layer: LayerView): string {
  const state =
    layer.total === 0
      ? "s-open"
      : layer.built === layer.total
        ? "s-done"
        : layer.built > 0
          ? "s-build"
          : "s-plan";
  const percent = layer.total === 0 ? 0 : Math.round((layer.built / layer.total) * 100);
  const detail = layer.total === 0 ? "Noch keine Issues" : `${layer.built} von ${layer.total} gebaut`;
  return `<div class="stop ${state}" style="--pct:${percent}%"><b>${inline(layer.name)}</b><span>${detail}</span></div>`;
}

const SHOWN_COUNTS: readonly Status[] = ["built", "review", "cut", "specified", "buildable", "grill", "triage"];

export function renderPage(overview: Overview, generatedAt: string): string {
  const bar = SHOWN_COUNTS.filter((status) => overview.counts[status] > 0)
    .map((status) => `<i style="flex:${overview.counts[status]};background:var(--${status})"></i>`)
    .join("");
  const tiles = SHOWN_COUNTS.filter((status) => overview.counts[status] > 0)
    .map(
      (status) =>
        `<div class="tile"><span class="dot" style="background:var(--${status})"></span><b>${overview.counts[status]}</b><span class="muted">${STATUS_LABELS[status]}</span></div>`,
    )
    .join("");
  const next = overview.nextSteps.map((step) => `<li>${step}</li>`).join("\n");
  const filters = FILTERS.map(
    ([key, label], index) =>
      `<button type="button" id="f-${index}" data-f="${key}" aria-pressed="${index === 0}">${label}</button>`,
  ).join("");
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Self-Engine Umbau-Stand</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Self-Engine Umbau-Stand</h1>
    <p>Stand ${escapeHtml(generatedAt)} UTC, erzeugt aus GitHub. Jede Zeile läuft durch vier Schritte: in der Schicht entschieden, per Grilling zum Spec, in Tickets geschnitten, gebaut.</p>
  </header>
  <div>
    <div class="bar" aria-hidden="true">${bar}</div>
    <div class="tiles">${tiles}<div class="tile"><span class="muted">von ${overview.total} Issues. Spätere Schichten haben noch keine.</span></div></div>
  </div>
  <div class="next"><h2>Als Nächstes</h2><ol>${next}</ol></div>
  <div><h2 class="gap">Der Weg bis zum Stichtag</h2><div class="route">${overview.layers.filter((layer) => layer.id !== "none").map(renderStop).join("")}</div></div>
  <div class="filters" role="group" aria-label="Zeilen filtern">${filters}</div>
  <div class="layers">${overview.layers.map(renderLayer).join("\n")}</div>
</div>
<script>${FILTER_SCRIPT}</script>
</body>
</html>
`;
}

const FILTER_SCRIPT = `
const group = document.querySelector(".filters");
const matches = (filter, status) => filter === "all" || (filter === "open" ? status !== "built" : filter.split(" ").includes(status) || (filter === "grill" && status === "planned"));
group.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  group.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  document.querySelectorAll("[data-layer]").forEach((layer) => {
    let any = false;
    layer.querySelectorAll(".row[data-s]").forEach((row) => {
      const shown = matches(button.dataset.f, row.dataset.s);
      row.classList.toggle("hidden", !shown);
      any = any || shown;
    });
    layer.classList.toggle("hidden", !any);
  });
});
`;

const DARK = `color-scheme: dark;
  --bg: #12151c; --panel: #1a1f29; --line: #2d3442; --ink: #e7eaf1; --muted: #9aa3b5; --accent: #7fa4f5;
  --built: #5cc28a; --review: #ad8cf0; --cut: #74a6f2; --specified: #74a6f2; --buildable: #4fc4c4; --grill: #eaa83e; --triage: #98a0b2; --planned: #eaa83e;`;

const STYLES = `
/* Layout idea: a route of layers on top, then one row per work package with a four-step pipeline. */
:root {
  --bg: #f5f6f8; --panel: #ffffff; --line: #dfe2e8; --ink: #1b2130; --muted: #5d6577; --accent: #2f5fd0;
  --built: #2e8b57; --review: #7a4fd0; --cut: #2f6fd0; --specified: #2f6fd0; --buildable: #0f8a8a; --grill: #c77700; --triage: #7b8294; --planned: #c77700;
  --sans: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${DARK} } }
:root[data-theme="dark"] { ${DARK} }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 14px/1.45 var(--sans); }
.wrap { max-width: 1160px; margin: 0 auto; padding: 28px 20px 56px; display: grid; gap: 28px; }
.layers { display: grid; gap: 18px; }
h1, h2, p { margin: 0; text-wrap: balance; }
h1 { font-size: 26px; font-weight: 600; }
h2 { font-size: 17px; font-weight: 600; }
.gap { margin-bottom: 12px; }
a { color: inherit; text-decoration-color: var(--line); text-underline-offset: 2px; }
a:hover { color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
header { display: grid; gap: 6px; }
header p { max-width: 75ch; color: var(--muted); }
.bar { display: flex; height: 12px; border-radius: 3px; overflow: hidden; gap: 2px; }
.bar i { display: block; min-width: 2px; }
.tiles { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 10px; }
.tile { display: flex; align-items: baseline; gap: 7px; }
.tile b { font: 500 19px var(--mono); }
.dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; align-self: center; }
.next { background: var(--panel); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 16px 18px; display: grid; gap: 10px; }
.next ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.route { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(130px, 1fr); overflow-x: auto; }
.stop { position: relative; padding: 22px 12px 0 0; display: grid; gap: 3px; align-content: start; }
.stop::before { content: ""; position: absolute; left: 0; right: 0; top: 7px; height: 2px; background: linear-gradient(90deg, var(--built) var(--pct), var(--line) var(--pct)); }
.stop::after { content: ""; position: absolute; left: 0; top: 1px; width: 14px; height: 14px; border-radius: 50%; background: var(--panel); border: 2px solid var(--line); }
.stop.s-done::after { background: var(--built); border-color: var(--built); }
.stop.s-build::after { border-color: var(--built); }
.stop.s-plan::after { border-color: var(--cut); }
.stop.s-open::after { border-color: var(--grill); border-style: dashed; }
.stop b { font-size: 13px; font-weight: 600; }
.stop span { font-size: 12px; color: var(--muted); }
.filters { display: flex; flex-wrap: wrap; gap: 6px; }
.filters button { font: 500 13px var(--sans); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 5px; padding: 5px 11px; cursor: pointer; }
.filters button[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
section.layer { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.lhead { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 13px 16px; border-bottom: 1px solid var(--line); align-items: baseline; }
.scroll { overflow-x: auto; }
.grid { min-width: 860px; }
.row { display: grid; grid-template-columns: minmax(230px, 1.5fr) 188px minmax(150px, 1fr) minmax(190px, 1.25fr); gap: 14px; padding: 9px 16px; border-bottom: 1px solid var(--line); align-items: center; }
.row:last-child { border-bottom: 0; }
.row.th { font-size: 11px; color: var(--muted); padding-block: 7px; }
.ttl { display: flex; gap: 8px; align-items: baseline; }
.ttl > .num { color: var(--muted); font-size: 12px; min-width: 34px; }
.pipe { display: grid; grid-template-columns: repeat(4, 1fr); position: relative; justify-items: center; }
.pipe::before { content: ""; position: absolute; left: 12%; right: 12%; top: 50%; height: 1px; background: var(--line); }
.heads { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; line-height: 1.1; }
.n { position: relative; width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--line); background: var(--panel); }
.n.done { background: var(--built); border-color: var(--built); }
.n.active { border-color: var(--review); background: conic-gradient(var(--review) 50%, var(--panel) 0); }
.n.none { border: 0; height: 2px; background: var(--muted); opacity: .55; margin-block: 6.5px; }
.kids { display: flex; flex-wrap: wrap; gap: 3px; }
.kid { width: 13px; height: 13px; border-radius: 2px; display: block; }
.kid.built { background: var(--built); }
.kid.review { background: var(--review); }
.kid.todo { background: var(--panel); border: 1.5px solid var(--muted); }
.st { display: grid; gap: 3px; font-size: 12.5px; }
.chip { justify-self: start; font-size: 11.5px; font-weight: 600; padding: 1px 7px; border-radius: 3px; border: 1px solid currentColor; }
.chip.built { color: var(--built); }
.chip.review { color: var(--review); }
.chip.cut, .chip.specified { color: var(--cut); }
.chip.buildable { color: var(--buildable); }
.chip.grill, .chip.planned { color: var(--grill); }
.chip.triage { color: var(--triage); }
.free { color: var(--built); font-weight: 500; }
.hidden { display: none !important; }
`;

function gh(args: readonly string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main(): void {
  const raw = JSON.parse(
    gh(["issue", "list", "--repo", REPO, "--state", "all", "--limit", "2000", "--json", "number,title,state,stateReason,labels,body"]),
  ) as readonly (Omit<Issue, "labels"> & { labels: readonly { name: string }[] })[];
  const issues = raw.map((issue) => ({ ...issue, labels: issue.labels.map((label) => label.name) }));
  const pullRequests = JSON.parse(
    gh(["pr", "list", "--repo", REPO, "--state", "open", "--limit", "200", "--json", "number,closingIssuesReferences"]),
  ) as readonly { number: number; closingIssuesReferences: readonly { number: number }[] }[];
  const closedBy = new Map(
    pullRequests.flatMap((pr) =>
      pr.closingIssuesReferences.map((issue) => [issue.number, pr.number] as const),
    ),
  );
  const roadmap = JSON.parse(readFileSync(ROADMAP, "utf8")) as Roadmap;
  const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  mkdirSync(".temp", { recursive: true });
  writeFileSync(OUTPUT, renderPage(buildOverview(issues, closedBy, roadmap), generatedAt));
  console.log(`plan-overview: wrote ${OUTPUT}`);
}

if (import.meta.main) main();
