// Builds the plan overview page (docs/agents/workflow.md, D155, D156) from GitHub and
// docs/plan/roadmap.json into .temp/plan-overview.html. It only writes that file; the agent
// publishes it. The whole page is regenerated each time, so a step someone forgot corrects itself.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const REPO = "Self-Engine/self-engine";
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
  /** ISO timestamps from GitHub; they feed the history charts. */
  readonly createdAt?: string;
  readonly closedAt?: string;
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

/** Another issue as a row shows it: in a tooltip, a blocker or a slice list. */
export interface IssueRef {
  readonly number: number;
  readonly title: string;
  readonly status: Status;
}

export interface Row {
  readonly number?: number;
  readonly title: string;
  readonly status: Status;
  readonly steps: readonly Step[];
  readonly slices: readonly IssueRef[];
  /** Open blockers; undefined for finished work and for rows without an issue. */
  readonly waitingOn?: readonly IssueRef[];
  readonly note?: string;
  /** What the issue is about, for the details panel. */
  readonly details?: {
    readonly summary?: string;
    readonly labels: readonly string[];
    readonly blockers: readonly IssueRef[];
    readonly pullRequest?: number;
  };
}

/** Issues created and built on one UTC day. */
export interface Day {
  readonly day: string;
  readonly created: number;
  readonly built: number;
}

export interface LayerView {
  readonly id: string;
  readonly name: string;
  readonly decisions?: string;
  readonly specNumber?: number;
  readonly rows: readonly Row[];
  readonly built: number;
  readonly total: number;
  /** Every counted issue of the layer, packages and slices, by status. */
  readonly statusCounts: Readonly<Record<Status, number>>;
}

/** Who has to act on an open issue next. */
export type Actor = "owner" | "agent" | "slices";

/** A work package or slice in the work tree, with its place in the open dependency graph. */
export interface GraphNode {
  readonly number: number;
  readonly title: string;
  readonly status: Status;
  /** The roadmap layer the package sits in; slices take their package's layer. */
  readonly layer: string;
  /** The package of a slice. */
  readonly parent?: number;
  /** The rest is set for open issues only. */
  readonly actor?: Actor;
  /** 0 when nothing open is in the way, otherwise one more than the latest open prerequisite. */
  readonly wave?: number;
  /** How many open issues wait on this one, directly or further down the chain. */
  readonly frees?: number;
  readonly waitsOn?: readonly number[];
  readonly unblocks?: readonly number[];
}

export interface Overview {
  readonly layers: readonly LayerView[];
  readonly counts: Readonly<Record<Status, number>>;
  readonly total: number;
  readonly nextSteps: readonly string[];
  /** One entry per day from the first created issue to the last event, gaps filled. */
  readonly history: readonly Day[];
  /** Every package and slice, packages before their slices. */
  readonly graph: readonly GraphNode[];
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

/** The status of a ticket, read from GitHub and never kept by hand (D155). The first match wins. */
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

const SUMMARY_SECTIONS = ["What to build", "Problem Statement", "Summary"];
const SUMMARY_LENGTH = 320;

/**
 * The first prose paragraph of the section that says what an issue is about, as plain text with
 * inline code kept; undefined when the body has none.
 */
export function summaryOf(body: string): string | undefined {
  const sections = body.split(/^## /mu);
  const intro = sections[0] ?? "";
  const named = SUMMARY_SECTIONS.map((name) =>
    sections.slice(1).find((section) => section.startsWith(name)),
  ).find((section) => section !== undefined);
  const text = named === undefined ? intro : named.slice(named.indexOf("\n") + 1);
  const paragraph = text
    .split(/\n\s*\n/u)
    .map((part) => part.trim())
    .find((part) => part !== "" && !/^(?:>|-|\*|\||```|\d+\.|Blocked by)/u.test(part));
  if (paragraph === undefined) return undefined;
  const plain = paragraph
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/\*\*|__/gu, "")
    .replace(/\s+/gu, " ");
  if (plain.length <= SUMMARY_LENGTH) return plain;
  const cut = plain.slice(0, SUMMARY_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" "))} …`;
}

function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Issues created and built per day; a closed issue counts as built on the day it closed. */
export function historyOf(issues: readonly Issue[]): Day[] {
  const created = new Map<string, number>();
  const built = new Map<string, number>();
  const add = (map: Map<string, number>, day: string): void => {
    map.set(day, (map.get(day) ?? 0) + 1);
  };
  for (const issue of issues) {
    if (issue.createdAt !== undefined) add(created, dayOf(issue.createdAt));
    if (issue.state === "CLOSED" && issue.closedAt !== undefined) add(built, dayOf(issue.closedAt));
  }
  const days = [...created.keys(), ...built.keys()].sort();
  const first = days[0];
  const last = days.at(-1);
  if (first === undefined || last === undefined) return [];
  const history: Day[] = [];
  for (let day = first; day <= last; day = nextDay(day)) {
    history.push({ day, created: created.get(day) ?? 0, built: built.get(day) ?? 0 });
  }
  return history;
}

export function actorOf(status: Status): Actor | undefined {
  switch (status) {
    case "grill":
    case "triage":
    case "review":
      return "owner";
    case "cut":
      return "slices";
    case "specified":
    case "buildable":
      return "agent";
    case "built":
    case "planned":
      return undefined;
  }
}

const MAX_WAVE = 50;

/**
 * Orders open issues into waves. An issue waits on its open blockers, and a package also waits on
 * its open slices, because it is finished only when they are. A cycle stops growing at MAX_WAVE.
 */
export function dependencyGraph(
  items: readonly {
    readonly number: number;
    readonly blockers: readonly number[];
    readonly parent?: number;
  }[],
): Map<number, { wave: number; frees: number; waitsOn: number[]; unblocks: number[] }> {
  const open = new Set(items.map((item) => item.number));
  const waitsOn = new Map(items.map((item) => [item.number, new Set<number>()]));
  for (const item of items) {
    for (const blocker of item.blockers) {
      if (open.has(blocker) && blocker !== item.number) waitsOn.get(item.number)?.add(blocker);
    }
    if (item.parent !== undefined && open.has(item.parent))
      waitsOn.get(item.parent)?.add(item.number);
  }
  const unblocks = new Map(items.map((item) => [item.number, [] as number[]]));
  for (const [number, before] of waitsOn)
    for (const blocker of before) unblocks.get(blocker)?.push(number);
  const wave = new Map(items.map((item) => [item.number, 0]));
  for (let changed = true, rounds = 0; changed && rounds < MAX_WAVE; rounds += 1) {
    changed = false;
    for (const [number, before] of waitsOn) {
      for (const blocker of before) {
        const next = Math.min((wave.get(blocker) ?? 0) + 1, MAX_WAVE);
        if (next > (wave.get(number) ?? 0)) {
          wave.set(number, next);
          changed = true;
        }
      }
    }
  }
  const reach = (start: number): number => {
    const seen = new Set([start]);
    const stack = [start];
    for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
      for (const next of unblocks.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return seen.size - 1;
  };
  return new Map(
    items.map((item) => [
      item.number,
      {
        wave: wave.get(item.number) ?? 0,
        frees: reach(item.number),
        waitsOn: [...(waitsOn.get(item.number) ?? [])].sort((a, b) => a - b),
        unblocks: (unblocks.get(item.number) ?? []).sort((a, b) => a - b),
      },
    ]),
  );
}

function emptyCounts(): Record<Status, number> {
  return {
    built: 0,
    review: 0,
    cut: 0,
    specified: 0,
    grill: 0,
    buildable: 0,
    triage: 0,
    planned: 0,
  };
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
    .filter(
      (issue) =>
        issue.state === "OPEN" ||
        (issue.stateReason !== "NOT_PLANNED" && issue.stateReason !== "DUPLICATE"),
    )
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

  const refOf = (other: Issue): IssueRef => ({
    number: other.number,
    title: other.title,
    status: status(other),
  });
  const rowOf = (issue: Issue): Row => {
    const current = status(issue);
    const blockers = blockersOf(issue.body)
      .map((n) => byNumber.get(n))
      .filter((other) => other !== undefined)
      .map(refOf);
    const summary = summaryOf(issue.body);
    const pullRequest = closedByOpenPullRequests.get(issue.number);
    return {
      number: issue.number,
      title: issue.title,
      status: current,
      steps: stepsOf(current, hasSpec(issue)),
      slices: (childrenOf.get(issue.number) ?? []).map(refOf),
      ...(current === "built"
        ? {}
        : {
            waitingOn: blockers.filter((blocker) => byNumber.get(blocker.number)?.state === "OPEN"),
          }),
      details: {
        ...(summary === undefined ? {} : { summary }),
        labels: issue.labels.filter((label) => !label.startsWith("layer:")),
        blockers,
        ...(pullRequest === undefined ? {} : { pullRequest }),
      },
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
      layer.id === "none" ? unassigned : packages.filter((issue) => layerIdOf(issue) === layer.id);
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
    const statusCounts = emptyCounts();
    for (const issue of counted) statusCounts[status(issue)] += 1;
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
      statusCounts,
    };
  });

  const counts = emptyCounts();
  for (const issue of sorted) counts[status(issue)] += 1;

  const openBlockers = (issue: Issue): boolean =>
    blockersOf(issue.body).some((n) => byNumber.get(n)?.state === "OPEN");
  const lowest = (wanted: Status, needsFree: boolean): Issue | undefined =>
    packages.find((issue) => status(issue) === wanted && !(needsFree && openBlockers(issue)));
  const pullRequests = [...new Set(closedByOpenPullRequests.values())].sort((a, b) => a - b);
  const toSlice = lowest("specified", false);
  const toGrill = lowest("grill", false);
  const toBuild = lowest("buildable", true);
  const nextSteps = [
    ...pullRequests.map(
      (n) =>
        `<a class="num" href="https://github.com/${REPO}/pull/${n}">PR #${n}</a> prüfen und mergen.`,
    ),
    ...(toSlice === undefined ? [] : [`Teil-Tickets schneiden: ${describe(toSlice)}.`]),
    ...(toGrill === undefined ? [] : [`Nächstes Grilling: ${describe(toGrill)}.`]),
    ...(toBuild === undefined ? [] : [`Baubar ohne Blocker: ${describe(toBuild)}.`]),
  ];

  return {
    layers: views,
    counts,
    total: sorted.length,
    nextSteps,
    history: historyOf(sorted),
    graph: graphOf(packages, childrenOf, status, (issue) =>
      known.has(layerIdOf(issue) ?? "") ? (layerIdOf(issue) ?? "none") : "none",
    ),
  };
}

function graphOf(
  packages: readonly Issue[],
  childrenOf: ReadonlyMap<number, readonly Issue[]>,
  status: (issue: Issue) => Status,
  layerOf: (issue: Issue) => string,
): GraphNode[] {
  const entries = packages.flatMap((pkg) => [
    { issue: pkg, layer: layerOf(pkg) },
    ...(childrenOf.get(pkg.number) ?? []).map((slice) => ({
      issue: slice,
      layer: layerOf(pkg),
      parent: pkg.number,
    })),
  ]);
  const open = entries.filter((entry) => entry.issue.state === "OPEN");
  const graph = dependencyGraph(
    open.map((entry) => ({
      number: entry.issue.number,
      blockers: blockersOf(entry.issue.body),
      ...("parent" in entry ? { parent: entry.parent } : {}),
    })),
  );
  return entries.map((entry) => {
    const current = status(entry.issue);
    const place = graph.get(entry.issue.number);
    const actor = actorOf(current);
    return {
      number: entry.issue.number,
      title: entry.issue.title,
      status: current,
      layer: entry.layer,
      ...("parent" in entry ? { parent: entry.parent } : {}),
      ...(place === undefined ? {} : { ...place, ...(actor === undefined ? {} : { actor }) }),
    };
  });
}

function describe(issue: Issue): string {
  return `${issueLink(issue.number)} ${inline(issue.title)}`;
}

function issueLink(number: number): string {
  return `<a class="num" href="https://github.com/${REPO}/issues/${number}">#${number}</a>`;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
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

function chipFor(status: Status): string {
  return `<span class="chip ${status}">${STATUS_LABELS[status]}</span>`;
}

/** A link to an issue that names it in the shared tooltip on hover and focus. */
function refLink(ref: IssueRef, className: string, content: string): string {
  return `<a class="${className}" href="https://github.com/${REPO}/issues/${ref.number}" data-tip="${escapeHtml(ref.title)}" data-sub="#${ref.number} · ${STATUS_LABELS[ref.status]}" aria-label="#${ref.number} ${escapeHtml(ref.title)}, ${STATUS_LABELS[ref.status]}">${content}</a>`;
}

function refList(refs: readonly IssueRef[]): string {
  return `<ul class="refs">${refs
    .map(
      (ref) =>
        `<li>${chipFor(ref.status)}${issueLink(ref.number)}<span>${inline(ref.title)}</span></li>`,
    )
    .join("")}</ul>`;
}

function renderDetails(row: Row & { readonly number: number }): string {
  const details = row.details;
  if (details === undefined) return "";
  const built = row.slices.filter((slice) => slice.status === "built").length;
  const facts = [
    details.labels.length === 0
      ? undefined
      : `<dt>Labels</dt><dd class="labels">${details.labels.map((label) => `<span class="label">${escapeHtml(label)}</span>`).join("")}</dd>`,
    details.pullRequest === undefined
      ? undefined
      : `<dt>Pull Request</dt><dd><a class="num" href="https://github.com/${REPO}/pull/${details.pullRequest}">PR #${details.pullRequest}</a> wartet auf Review</dd>`,
    details.blockers.length === 0
      ? undefined
      : `<dt>Blockiert durch</dt><dd>${refList(details.blockers)}</dd>`,
    row.slices.length === 0
      ? undefined
      : `<dt>Teil-Tickets</dt><dd><span class="muted">${built} von ${row.slices.length} gebaut</span>${refList(row.slices)}</dd>`,
  ].filter((fact) => fact !== undefined);
  return `<div class="detail" id="d-${row.number}" hidden>
    <p>${details.summary === undefined ? '<span class="muted">Das Issue hat keine Beschreibung in Prosa.</span>' : inline(details.summary)}</p>
    ${facts.length === 0 ? "" : `<dl>${facts.join("")}</dl>`}
    <a class="gh" href="https://github.com/${REPO}/issues/${row.number}">#${row.number} auf GitHub öffnen ↗</a>
  </div>`;
}

function renderRow(row: Row): string {
  const steps = row.steps.map((step) => `<span class="n ${step}"></span>`).join("");
  const label = row.steps
    .map((step, index) => `${STEP_NAMES[index] ?? ""}: ${STEP_STATES[step]}`)
    .join(", ");
  const slices = row.slices
    .map((slice) =>
      refLink(
        slice,
        `kid ${slice.status === "built" || slice.status === "review" ? slice.status : "todo"}`,
        "",
      ),
    )
    .join("");
  const sliceCount =
    row.slices.length === 0
      ? ""
      : `<span class="kc num">${row.slices.filter((slice) => slice.status === "built").length}/${row.slices.length}</span>`;
  const waiting =
    row.waitingOn === undefined
      ? ""
      : row.waitingOn.length === 0
        ? '<span class="free">Keine Blocker</span>'
        : `<span class="muted">Wartet auf ${row.waitingOn.map((ref) => refLink(ref, "num", `#${ref.number}`)).join(", ")}</span>`;
  const note = row.note === undefined ? "" : `<span class="muted">${inline(row.note)}</span>`;
  const title =
    row.number === undefined
      ? `<span class="num">–</span><span>${inline(row.title)}</span>`
      : `${issueLink(row.number)}<button type="button" class="open" aria-expanded="false" aria-controls="d-${row.number}">${inline(row.title)}</button>`;
  return `<div class="row" data-s="${row.status}">
  <div class="ttl">${title}</div>
  <div class="pipe" role="img" aria-label="${label}">${steps}</div>
  <div class="kids">${slices}${sliceCount}</div>
  <div class="st">${chipFor(row.status)}${waiting}${note}</div>
  ${row.number === undefined ? "" : renderDetails({ ...row, number: row.number })}
</div>`;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function shortDay(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
}

function longDay(day: string): string {
  return `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? ""} ${shortDay(day)}`;
}

/** The smallest 1-2-5 step that splits `max` into at most four gridlines. */
function niceStep(max: number): number {
  const rough = Math.max(max, 1) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].map((factor) => factor * power).find((step) => step >= rough) ?? rough;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A bar whose top corners are rounded and whose foot sits on the baseline. */
function barPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return "";
  const r = Math.min(4, width / 2, height);
  return `M${round(x)},${round(y + height)}V${round(y + r)}Q${round(x)},${round(y)} ${round(x + r)},${round(y)}H${round(x + width - r)}Q${round(x + width)},${round(y)} ${round(x + width)},${round(y + r)}V${round(y + height)}Z`;
}

interface Frame {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function axes(
  frame: Frame,
  max: number,
  step: number,
  days: readonly Day[],
  xOf: (index: number) => number,
): string {
  const y = (value: number): number =>
    frame.top + (frame.height - frame.top - frame.bottom) * (1 - value / max);
  const grid: string[] = [];
  for (let value = 0; value <= max; value += step) {
    grid.push(
      `<line class="${value === 0 ? "base" : "gl"}" x1="${frame.left}" x2="${frame.width - frame.right}" y1="${round(y(value))}" y2="${round(y(value))}"/><text class="ax" x="${frame.left - 6}" y="${round(y(value) + 4)}" text-anchor="end">${value}</text>`,
    );
  }
  const every = Math.max(1, Math.ceil(days.length / 8));
  const ticks = days
    .map((day, index) =>
      index % every === 0 || index === days.length - 1
        ? `<text class="ax" x="${round(xOf(index))}" y="${frame.height - 6}" text-anchor="middle">${shortDay(day.day)}</text>`
        : "",
    )
    .join("");
  return grid.join("") + ticks;
}

/** Cumulative created and built issues; the gap between the lines is the open work. */
function renderBurnUp(days: readonly Day[]): string {
  const frame: Frame = { width: 560, height: 230, left: 36, right: 96, top: 12, bottom: 24 };
  let created = 0;
  let built = 0;
  const points = days.map((day) => {
    created += day.created;
    built += day.built;
    return { day: day.day, created, built };
  });
  const step = niceStep(created);
  const max = Math.ceil(Math.max(created, 1) / step) * step;
  const plot = frame.width - frame.left - frame.right;
  const xOf = (index: number): number =>
    frame.left + (points.length === 1 ? plot / 2 : (index * plot) / (points.length - 1));
  const yOf = (value: number): number =>
    frame.top + (frame.height - frame.top - frame.bottom) * (1 - value / max);
  const line = (key: "created" | "built"): string =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${round(xOf(index))},${round(yOf(point[key]))}`,
      )
      .join("");
  const dots = (key: "created" | "built"): string =>
    points
      .map(
        (point, index) =>
          `<circle class="dot-${key}" cx="${round(xOf(index))}" cy="${round(yOf(point[key]))}" r="4"/>`,
      )
      .join("");
  const last = points.at(-1);
  const half = points.length === 1 ? plot / 2 : plot / (points.length - 1) / 2;
  const hits = points
    .map(
      (point, index) =>
        `<g class="hit" data-tip="${point.built} gebaut · ${point.created} angelegt" data-sub="${longDay(point.day)}: ${point.created - point.built} offen"><rect x="${round(xOf(index) - half)}" y="${frame.top}" width="${round(half * 2)}" height="${frame.height - frame.top - frame.bottom}"/><line x1="${round(xOf(index))}" x2="${round(xOf(index))}" y1="${frame.top}" y2="${frame.height - frame.bottom}"/></g>`,
    )
    .join("");
  let labels = "";
  if (last !== undefined) {
    let yCreated = yOf(last.created);
    let yBuilt = yOf(last.built);
    if (yBuilt - yCreated < 16) {
      const middle = (yBuilt + yCreated) / 2;
      yCreated = middle - 8;
      yBuilt = middle + 8;
    }
    const x = xOf(points.length - 1) + 10;
    labels = `<text class="dl" x="${round(x)}" y="${round(yCreated + 4)}">${last.created} angelegt</text><text class="dl" x="${round(x)}" y="${round(yBuilt + 4)}">${last.built} gebaut</text>`;
  }
  return `<svg viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="Angelegte und gebaute Issues, kumuliert pro Tag">
  ${axes(frame, max, step, days, xOf)}
  <path class="ln-created" d="${line("created")}"/><path class="ln-built" d="${line("built")}"/>
  ${dots("created")}${dots("built")}${labels}${hits}
</svg>`;
}

/** Issues created and built on each day, side by side. */
function renderDaily(days: readonly Day[]): string {
  const frame: Frame = { width: 560, height: 230, left: 36, right: 12, top: 12, bottom: 24 };
  const peak = Math.max(1, ...days.flatMap((day) => [day.created, day.built]));
  const step = niceStep(peak);
  const max = Math.ceil(peak / step) * step;
  const plot = frame.width - frame.left - frame.right;
  const slot = plot / Math.max(days.length, 1);
  const xOf = (index: number): number => frame.left + slot * (index + 0.5);
  const inner = frame.height - frame.top - frame.bottom;
  const barWidth = Math.min(18, (slot - 10) / 2);
  const bars = days
    .map((day, index) => {
      const x = xOf(index);
      const hCreated = (inner * day.created) / max;
      const hBuilt = (inner * day.built) / max;
      return `<g class="hit" tabindex="0" data-tip="${day.built} gebaut · ${day.created} angelegt" data-sub="${longDay(day.day)}"><rect x="${round(x - slot / 2)}" y="${frame.top}" width="${round(slot)}" height="${inner}"/><path class="bar-created" d="${barPath(x - barWidth - 1, frame.top + inner - hCreated, barWidth, hCreated)}"/><path class="bar-built" d="${barPath(x + 1, frame.top + inner - hBuilt, barWidth, hBuilt)}"/></g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="Angelegte und gebaute Issues pro Tag">
  ${axes(frame, max, step, days, xOf)}${bars}
</svg>`;
}

/** Status groups for the layer chart; specified and cut share a colour, so they share a segment. */
const LAYER_SEGMENTS: readonly {
  readonly statuses: readonly Status[];
  readonly label: string;
  readonly color: Status;
}[] = [
  { statuses: ["built"], label: "Gebaut", color: "built" },
  { statuses: ["review"], label: "Im Review", color: "review" },
  { statuses: ["cut", "specified"], label: "Geschnitten oder spezifiziert", color: "cut" },
  { statuses: ["buildable"], label: "Baubar", color: "buildable" },
  { statuses: ["grill"], label: "Grilling nötig", color: "grill" },
  { statuses: ["triage"], label: "Triage offen", color: "triage" },
];

function renderLayerBars(layers: readonly LayerView[]): string {
  const legend = LAYER_SEGMENTS.map(
    (segment) => `<span><i style="background:var(--${segment.color})"></i>${segment.label}</span>`,
  ).join("");
  const rows = layers
    .map((layer) => {
      const segments = LAYER_SEGMENTS.map((segment) => ({
        ...segment,
        count: segment.statuses.reduce((sum, status) => sum + layer.statusCounts[status], 0),
      }))
        .filter((segment) => segment.count > 0)
        .map(
          (segment) =>
            `<i tabindex="0" style="flex:${segment.count};background:var(--${segment.color})" data-tip="${segment.count} ${segment.label.toLowerCase()}" data-sub="${escapeHtml(layer.name)} · ${segment.count} von ${layer.total}"></i>`,
        )
        .join("");
      const bar =
        layer.total === 0
          ? '<span class="muted">Noch keine Issues</span>'
          : `<div class="stack">${segments}</div>`;
      return `<div class="lbar"><span>${inline(layer.name)}</span>${bar}<span class="num muted">${layer.total === 0 ? "" : `${layer.built}/${layer.total}`}</span></div>`;
    })
    .join("");
  return `<div class="legend">${legend}</div><div class="lbars">${rows}</div>`;
}

function renderHistoryTable(days: readonly Day[]): string {
  let created = 0;
  let built = 0;
  const rows = days
    .map((day) => {
      created += day.created;
      built += day.built;
      return `<tr><td>${longDay(day.day)}</td><td>${day.created}</td><td>${day.built}</td><td>${created}</td><td>${built}</td><td>${created - built}</td></tr>`;
    })
    .join("");
  return `<details class="tbl"><summary>Verlauf als Tabelle</summary><table class="num"><thead><tr><th>Tag</th><th>Angelegt</th><th>Gebaut</th><th>Angelegt, kumuliert</th><th>Gebaut, kumuliert</th><th>Offen</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

function renderCharts(overview: Overview): string {
  const lineKeys =
    '<div class="legend"><span><b class="key-created"></b>Angelegt</span><span><b class="key-built"></b>Gebaut</span></div>';
  const barKeys =
    '<div class="legend"><span><i style="background:var(--c-created)"></i>Angelegt</span><span><i style="background:var(--c-built)"></i>Gebaut</span></div>';
  const history =
    overview.history.length === 0
      ? ""
      : `<div class="card"><h3>Angelegt und gebaut, kumuliert</h3><p class="muted">Der Abstand zwischen den Linien ist die offene Arbeit.</p>${lineKeys}${renderBurnUp(overview.history)}</div>
  <div class="card"><h3>Pro Tag</h3><p class="muted">Kommen mehr Issues hinzu, als gebaut werden, wächst der Rückstand.</p>${barKeys}${renderDaily(overview.history)}</div>`;
  return `<div><h2 class="gap">Verlauf</h2><div class="charts">
  ${history}
  <div class="card wide"><h3>Status je Schicht</h3><p class="muted">Arbeitspakete und ihre Teil-Tickets, nach Status.</p>${renderLayerBars(overview.layers)}</div>
  </div>${overview.history.length === 0 ? "" : renderHistoryTable(overview.history)}</div>`;
}

/** JSON for an inline script block; `<` is escaped so no title can close the block. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c");
}

const TREE_MODES: readonly (readonly [string, string])[] = [
  ["todo", "Wo etwas zu tun ist"],
  ["owner", "Wartet auf dich"],
  ["now", "Agent kann jetzt bauen"],
  ["all", "Alles"],
];

function renderWorkTree(overview: Overview): string {
  const modes = TREE_MODES.map(
    ([key, label], index) =>
      `<button type="button" data-mode="${key}" aria-pressed="${index === 0}">${label}</button>`,
  ).join("");
  const data = {
    layers: overview.layers.map((layer) => ({ id: layer.id, name: layer.name })),
    nodes: overview.graph,
    labels: STATUS_LABELS,
  };
  return `<div class="wt">
  <h2 class="gap">Wer ist wo dran</h2>
  <p class="muted wt-intro">Schicht → Arbeitspaket → Teil-Ticket. An jedem offenen Issue steht, wer handeln muss, ob es jetzt geht und wie viele Issues dahinter warten. Klick klappt einen Ast auf oder zu, bei einem Arbeitspaket ohne Teil-Tickets öffnet er seine Details in der Tabelle. Hover zeigt, worauf ein Issue wartet (orange) und was es freigibt (grün).</p>
  <div class="filters wt-modes" role="group" aria-label="Baum filtern">${modes}</div>
  <div class="wt-box"><svg class="wt-svg" role="tree" aria-label="Arbeitsbaum"></svg></div>
  <div class="wt-legend"><span><b class="wt-key owner">Du</b>entscheidest oder prüfst</span><span><b class="wt-key agent">Agent</b>kann bauen</span><span><b class="wt-key slices">sammelt</b>fertig, wenn die Teil-Tickets fertig sind</span><span><b class="wt-key frees">gibt 3 frei</b>so viele Issues warten dahinter</span></div>
  <script type="application/json" id="wt-data">${scriptJson(data)}</script>
</div>`;
}

const TREE_SCRIPT = `
(() => {
const data = JSON.parse(document.getElementById("wt-data").textContent);
const svg = document.querySelector(".wt-svg");
const NS = "http://www.w3.org/2000/svg";
const ROW = 23, LABEL = 38;
// Packages carry badges, so the slice column starts further out.
const X = [0, 270, 540, 1010];
const ACTOR = { owner: "Du", agent: "Agent", slices: "sammelt" };
const byNumber = new Map(data.nodes.map((node) => [node.number, node]));
const make = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; };
const short = (text) => text.length > LABEL ? text.slice(0, LABEL - 1) + "…" : text;
let mode = "todo";
const collapsed = new Set();
const isMatch = (node) => node.actor !== undefined && (mode === "owner" ? node.actor === "owner" : mode === "now" ? node.actor === "agent" && node.wave === 0 : true);
function tree() {
  const issue = (node) => ({ key: node.number, node, kids: data.nodes.filter((child) => child.parent === node.number).map(issue) });
  const root = { key: "root", name: "Self-Engine", kids: data.layers.map((layer) => ({ key: "L" + layer.id, name: layer.name, kids: data.nodes.filter((node) => node.parent === undefined && node.layer === layer.id).map(issue) })) };
  const count = (t) => { t.kids.forEach(count); const own = t.node ? [t.node] : []; t.issues = [...own, ...t.kids.flatMap((k) => k.issues)]; t.total = t.issues.length; t.built = t.issues.filter((n) => n.status === "built").length; t.hit = t.issues.some(isMatch); };
  const prune = (t) => { t.kids = t.kids.filter((k) => k.issues.length > 0 && (mode === "all" || k.issues.some((n) => n.actor !== undefined))); t.kids.forEach(prune); };
  count(root); prune(root);
  return root;
}
function reset() {
  collapsed.clear();
  const walk = (t, depth) => { if (t.kids.length && depth >= 2) collapsed.add(t.key); if ((mode === "owner" || mode === "now") && t.hit) collapsed.delete(t.key); if ((mode === "owner" || mode === "now") && !t.hit && depth >= 1 && t.kids.length) collapsed.add(t.key); t.kids.forEach((k) => walk(k, depth + 1)); };
  walk(tree(), 0);
}
function draw() {
  const root = tree();
  let row = 0, depthMax = 0;
  const place = (t, depth) => { t.x = X[depth]; depthMax = Math.max(depthMax, depth); const open = t.kids.length && !collapsed.has(t.key); if (open) { t.kids.forEach((k) => place(k, depth + 1)); t.y = (t.kids[0].y + t.kids[t.kids.length - 1].y) / 2; } else { t.y = row++ * ROW; } };
  place(root, 0);
  svg.replaceChildren();
  svg.setAttribute("width", X[depthMax] + 560); svg.setAttribute("height", row * ROW + 24);
  const g = make("g", { transform: "translate(16,14)" }); svg.append(g);
  const links = make("g", {}), arcs = make("g", {}), nodes = make("g", {}); g.append(links, arcs, nodes);
  const shown = new Map();
  const visit = (t) => {
    if (t.node) shown.set(t.node.number, t);
    const open = t.kids.length && !collapsed.has(t.key);
    if (open) t.kids.forEach((k) => { const mx = (t.x + k.x) / 2; links.append(make("path", { class: "wt-link", d: "M" + t.x + "," + t.y + "C" + mx + "," + t.y + " " + mx + "," + k.y + " " + k.x + "," + k.y })); visit(k); });
    const node = t.node;
    const dim = (mode === "owner" || mode === "now") && !t.hit;
    const n = make("g", { class: "wt-node" + (t.total && t.built === t.total ? " done" : "") + (dim ? " dim" : ""), transform: "translate(" + t.x + "," + t.y + ")", tabindex: "0", role: "treeitem" });
    if (t.kids.length) n.setAttribute("aria-expanded", String(!collapsed.has(t.key)));
    n.append(make("circle", { r: node ? (node.parent === undefined ? 6 : 4) : 7, class: node ? "s-" + node.status : "wt-group" + (t.kids.length && collapsed.has(t.key) ? " closed" : "") }));
    const text = make("text", { x: 11, dy: "0.35em" }, node ? "#" + node.number + " " + short(node.title) : t.name);
    if (t.total > 1 || (t.kids.length && collapsed.has(t.key))) text.append(make("tspan", { class: "wt-count", dx: 8 }, t.built + "/" + t.total + (collapsed.has(t.key) ? " ▸" : "")));
    if (node && node.actor && node.actor !== "slices") text.append(make("tspan", { class: "wt-actor " + node.actor, dx: 8 }, ACTOR[node.actor] + (node.wave === 0 ? " · jetzt" : "")));
    if (node && node.frees) text.append(make("tspan", { class: "wt-frees", dx: 6 }, "gibt " + node.frees + " frei"));
    n.append(text);
    if (node) { n.dataset.tip = node.title; n.dataset.sub = "#" + node.number + " · " + data.labels[node.status] + (node.actor ? " · " + (node.wave === 0 ? "jetzt möglich" : "Welle " + (node.wave + 1)) + (node.frees ? " · gibt " + node.frees + " frei" : "") : ""); }
    const act = () => {
      if (t.kids.length) { collapsed.has(t.key) ? collapsed.delete(t.key) : collapsed.add(t.key); draw(); svg.querySelector('[data-key="' + t.key + '"]')?.focus(); return; }
      if (!node) return;
      const toggle = document.querySelector('button.open[aria-controls="d-' + node.number + '"]');
      if (!toggle) { window.open("https://github.com/${REPO}/issues/" + node.number, "_blank"); return; }
      const all = document.querySelector('.filters:not(.wt-modes) button[data-f="all"]'); if (toggle.closest(".hidden")) all?.click();
      if (toggle.getAttribute("aria-expanded") !== "true") toggle.click();
      toggle.scrollIntoView({ behavior: "smooth", block: "center" }); toggle.focus({ preventScroll: true });
    };
    n.dataset.key = t.key;
    n.addEventListener("click", act);
    n.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); act(); } });
    if (node && node.actor) { const show = () => drawArcs(node); n.addEventListener("pointerenter", show); n.addEventListener("focus", show); n.addEventListener("pointerleave", () => arcs.replaceChildren()); n.addEventListener("blur", () => arcs.replaceChildren()); }
    nodes.append(n);
  };
  visit(root);
  function drawArcs(node) {
    arcs.replaceChildren();
    const me = shown.get(node.number); if (!me) return;
    const line = (other, cls) => { const o = shown.get(other); if (!o) return; const bend = 70 + Math.abs(o.y - me.y) * 0.15; arcs.append(make("path", { class: "wt-arc " + cls, d: "M" + (o.x - 8) + "," + o.y + "C" + (o.x - bend) + "," + o.y + " " + (me.x - bend) + "," + me.y + " " + (me.x - 8) + "," + me.y })); };
    (node.waitsOn || []).forEach((n) => line(n, "before")); (node.unblocks || []).forEach((n) => line(n, "after"));
  }
}
document.querySelector(".wt-modes").addEventListener("click", (event) => {
  const button = event.target.closest("button"); if (!button) return;
  mode = button.dataset.mode;
  button.parentElement.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  reset(); draw();
});
reset(); draw();
})();
`;

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
  const detail =
    layer.total === 0 ? "Noch keine Issues" : `${layer.built} von ${layer.total} gebaut`;
  return `<div class="stop ${state}" style="--pct:${percent}%"><b>${inline(layer.name)}</b><span>${detail}</span></div>`;
}

const SHOWN_COUNTS: readonly Status[] = [
  "built",
  "review",
  "cut",
  "specified",
  "buildable",
  "grill",
  "triage",
];

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
  <div><h2 class="gap">Der Weg bis zum Stichtag</h2><div class="route">${overview.layers
    .filter((layer) => layer.id !== "none")
    .map(renderStop)
    .join("")}</div></div>
  ${renderWorkTree(overview)}
  ${renderCharts(overview)}
  <div class="tools"><div class="filters" role="group" aria-label="Zeilen filtern">${filters}</div><button type="button" class="expand" aria-pressed="false">Alle Details aufklappen</button></div>
  <div class="layers">${overview.layers.map(renderLayer).join("\n")}</div>
</div>
<div id="tip" class="tip" role="tooltip" hidden></div>
<script>${FILTER_SCRIPT}${DETAILS_SCRIPT}${TOOLTIP_SCRIPT}${TREE_SCRIPT}</script>
</body>
</html>
`;
}

const FILTER_SCRIPT = `
const group = document.querySelector(".filters:not(.wt-modes)");
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

const DETAILS_SCRIPT = `
const toggle = (button, open) => {
  button.setAttribute("aria-expanded", String(open));
  document.getElementById(button.getAttribute("aria-controls")).hidden = !open;
};
document.querySelectorAll("button.open").forEach((button) => {
  button.addEventListener("click", () => toggle(button, button.getAttribute("aria-expanded") !== "true"));
});
const expand = document.querySelector("button.expand");
expand.addEventListener("click", () => {
  const open = expand.getAttribute("aria-pressed") !== "true";
  expand.setAttribute("aria-pressed", String(open));
  expand.textContent = open ? "Alle Details zuklappen" : "Alle Details aufklappen";
  document.querySelectorAll("button.open").forEach((button) => toggle(button, open));
});
`;

// One tooltip for the whole page. It is fixed to the viewport, so a scrolling table cannot clip it.
const TOOLTIP_SCRIPT = `
const tip = document.getElementById("tip");
const place = (x, y) => {
  const left = Math.min(x + 14, window.innerWidth - tip.offsetWidth - 8);
  const top = y + 18 + tip.offsetHeight > window.innerHeight ? y - tip.offsetHeight - 12 : y + 18;
  tip.style.left = Math.max(8, left) + "px";
  tip.style.top = Math.max(8, top) + "px";
};
const show = (target) => {
  const strong = document.createElement("b");
  strong.textContent = target.dataset.tip;
  const sub = document.createElement("span");
  sub.textContent = target.dataset.sub || "";
  tip.replaceChildren(strong, sub);
  tip.hidden = false;
};
document.addEventListener("pointerover", (event) => {
  const target = event.target.closest("[data-tip]");
  if (!target) { tip.hidden = true; return; }
  show(target);
  place(event.clientX, event.clientY);
});
document.addEventListener("pointermove", (event) => { if (!tip.hidden) place(event.clientX, event.clientY); });
document.addEventListener("focusin", (event) => {
  const target = event.target.closest("[data-tip]");
  if (!target) return;
  show(target);
  const box = target.getBoundingClientRect();
  place(box.left + box.width / 2, box.bottom - 10);
});
document.addEventListener("focusout", () => { tip.hidden = true; });
window.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });
`;

const DARK = `color-scheme: dark;
  --bg: #12151c; --panel: #1a1f29; --line: #2d3442; --ink: #e7eaf1; --muted: #9aa3b5; --accent: #7fa4f5;
  --built: #5cc28a; --review: #ad8cf0; --cut: #74a6f2; --specified: #74a6f2; --buildable: #4fc4c4; --grill: #eaa83e; --triage: #98a0b2; --planned: #eaa83e;
  --c-created: #5a86e0; --c-built: #34a066;`;

const STYLES = `
/* Layout idea: a route of layers on top, then one row per work package with a four-step pipeline. */
:root {
  --bg: #f5f6f8; --panel: #ffffff; --line: #dfe2e8; --ink: #1b2130; --muted: #5d6577; --accent: #2f5fd0;
  --built: #2e8b57; --review: #7a4fd0; --cut: #2f6fd0; --specified: #2f6fd0; --buildable: #0f8a8a; --grill: #c77700; --triage: #7b8294; --planned: #c77700;
  --c-created: #2f6fd0; --c-built: #2e8b57;
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
.wt { display: grid; gap: 10px; }
.wt > h2.gap { margin-bottom: 0; }
.wt-intro { max-width: 90ch; font-size: 13px; }
.wt-box { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; overflow: auto; max-height: 720px; padding: 6px 0; }
.wt-svg { display: block; }
.wt-link { fill: none; stroke: var(--line); stroke-width: 1.2; }
.wt-node { cursor: pointer; outline: none; }
.wt-node text { fill: var(--ink); font-size: 12.5px; }
.wt-node.done text { fill: var(--muted); }
.wt-node.dim { opacity: .3; }
.wt-node:hover text, .wt-node:focus-visible text { fill: var(--accent); }
.wt-node:focus-visible circle { stroke: var(--accent); stroke-width: 3; }
.wt-node circle.wt-group { fill: var(--panel); stroke: var(--accent); stroke-width: 2; }
.wt-node circle.wt-group.closed { stroke: var(--ink); }
.wt-node circle.s-built { fill: var(--built); } .wt-node circle.s-review { fill: var(--review); }
.wt-node circle.s-cut, .wt-node circle.s-specified { fill: var(--cut); } .wt-node circle.s-buildable { fill: var(--buildable); }
.wt-node circle.s-grill, .wt-node circle.s-planned { fill: var(--grill); } .wt-node circle.s-triage { fill: var(--triage); }
.wt-count { fill: var(--muted); font: 11px var(--mono); }
.wt-actor { font-size: 11px; font-weight: 600; }
.wt-actor.owner { fill: var(--grill); } .wt-actor.agent { fill: var(--buildable); }
.wt-frees { fill: var(--built); font-size: 11px; }
.wt-arc { fill: none; stroke-width: 1.8; stroke-dasharray: 4 3; }
.wt-arc.before { stroke: var(--grill); } .wt-arc.after { stroke: var(--built); }
.wt-legend { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 12px; color: var(--muted); }
.wt-key { font-size: 11px; font-weight: 600; margin-right: 5px; }
.wt-key.owner { color: var(--grill); } .wt-key.agent { color: var(--buildable); } .wt-key.slices { color: var(--cut); } .wt-key.frees { color: var(--built); font-weight: 400; }
.tools { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: space-between; align-items: center; }
.tools > button, .tbl summary { font: 500 13px var(--sans); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 5px; padding: 5px 11px; cursor: pointer; }
.tools > button[aria-pressed="true"] { border-color: var(--accent); }
.kids { align-items: center; }
.kid:hover, .kid:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.kc { font-size: 11.5px; color: var(--muted); margin-left: 6px; }
.open { all: unset; cursor: pointer; display: inline; }
.open::after { content: "▸"; display: inline-block; margin-left: 6px; color: var(--muted); font-size: 11px; transition: transform .15s; }
.open[aria-expanded="true"]::after { transform: rotate(90deg); }
.open:hover { color: var(--accent); }
.open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }
.detail { grid-column: 1 / -1; display: grid; gap: 10px; margin: 2px 0 6px 42px; padding: 12px 14px; border-left: 3px solid var(--line); background: var(--bg); border-radius: 0 5px 5px 0; max-width: 90ch; }
.detail[hidden] { display: none; }
.detail dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
.detail dt { color: var(--muted); font-size: 12.5px; }
.detail dd { margin: 0; display: grid; gap: 4px; }
.labels { display: flex !important; flex-wrap: wrap; gap: 4px; }
.label { font: 400 11.5px var(--mono); border: 1px solid var(--line); border-radius: 3px; padding: 0 6px; }
.refs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.refs li { display: grid; grid-template-columns: 112px 42px 1fr; gap: 8px; align-items: baseline; }
.refs .chip { justify-self: start; }
.refs li > .num { color: var(--muted); font-size: 12px; }
.gh { justify-self: start; font-size: 12.5px; color: var(--accent); }
.tip { position: fixed; z-index: 10; pointer-events: none; max-width: 340px; display: grid; gap: 2px; padding: 7px 10px; border-radius: 5px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 6px 18px rgb(0 0 0 / .18); font-size: 12.5px; }
.tip[hidden] { display: none; }
.tip span { color: var(--muted); }
.tip span:empty { display: none; }
.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 14px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; }
.card.wide { grid-column: 1 / -1; }
.card h3 { margin: 0; font-size: 14px; font-weight: 600; }
.card p { font-size: 12.5px; }
.card svg { width: 100%; height: auto; display: block; overflow: visible; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.legend b { width: 14px; height: 2px; border-radius: 1px; display: inline-block; }
.key-created { background: var(--c-created); }
.key-built { background: var(--c-built); }
.gl { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 3; }
.base { stroke: var(--muted); stroke-width: 1; opacity: .6; }
.ax { fill: var(--muted); font: 400 10.5px var(--mono); }
.dl { fill: var(--ink); font: 500 11.5px var(--sans); }
.ln-created, .ln-built { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.ln-created { stroke: var(--c-created); }
.ln-built { stroke: var(--c-built); }
.dot-created, .dot-built { stroke: var(--panel); stroke-width: 2; }
.dot-created { fill: var(--c-created); }
.dot-built { fill: var(--c-built); }
.bar-created { fill: var(--c-created); }
.bar-built { fill: var(--c-built); }
.hit { outline: none; }
.hit rect { fill: transparent; }
.hit line { stroke: var(--muted); stroke-width: 1; opacity: 0; }
.hit:hover line, .hit:focus-visible line { opacity: .8; }
.hit:hover rect, .hit:focus-visible rect { fill: var(--line); fill-opacity: .35; }
.card svg .hit:has(line):hover rect { fill: transparent; }
.lbars { display: grid; gap: 8px; margin-top: 4px; }
.lbar { display: grid; grid-template-columns: minmax(150px, 220px) 1fr 52px; gap: 12px; align-items: center; font-size: 13px; }
.lbar > .num { text-align: right; font-size: 12px; }
.stack { display: flex; gap: 2px; height: 14px; }
.stack i { display: block; min-width: 3px; cursor: default; }
.stack i:first-child { border-radius: 2px 0 0 2px; }
.stack i:last-child { border-radius: 0 4px 4px 0; }
.stack i:only-child { border-radius: 2px 4px 4px 2px; }
.stack i:hover, .stack i:focus-visible { filter: brightness(1.15); outline: 2px solid var(--ink); outline-offset: 1px; }
.tbl { margin-top: 10px; }
.tbl summary { display: inline-block; list-style: none; }
.tbl table { margin-top: 8px; border-collapse: collapse; font-size: 12.5px; }
.tbl th, .tbl td { padding: 4px 12px 4px 0; text-align: right; border-bottom: 1px solid var(--line); }
.tbl th:first-child, .tbl td:first-child { text-align: left; }
.tbl th { font: 500 11.5px var(--sans); color: var(--muted); }
`;

function gh(args: readonly string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main(): void {
  const raw = JSON.parse(
    gh([
      "issue",
      "list",
      "--repo",
      REPO,
      "--state",
      "all",
      "--limit",
      "2000",
      "--json",
      "number,title,state,stateReason,labels,body,createdAt,closedAt",
    ]),
  ) as readonly (Omit<Issue, "labels"> & { labels: readonly { name: string }[] })[];
  const issues = raw.map((issue) => ({
    ...issue,
    labels: issue.labels.map((label) => label.name),
  }));
  const pullRequests = JSON.parse(
    gh([
      "pr",
      "list",
      "--repo",
      REPO,
      "--state",
      "open",
      "--limit",
      "200",
      "--json",
      "number,closingIssuesReferences",
    ]),
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
