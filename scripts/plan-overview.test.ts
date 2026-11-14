import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import {
  blockersOf,
  buildOverview,
  escapeHtml,
  historyOf,
  parentOf,
  renderPage,
  statusOf,
  summaryOf,
  type Issue,
  type Roadmap,
} from "./plan-overview.ts";

function issue(number: number, overrides: Partial<Issue> = {}): Issue {
  return { number, title: `Issue ${number}`, state: "OPEN", labels: [], body: "", ...overrides };
}

const ROADMAP: Roadmap = {
  layers: [
    { id: "1", name: "One" },
    { id: "2", name: "Two", planned: [{ title: "Later work", note: "Open." }] },
  ],
};
const free = { hasOpenPullRequest: false, hasChildren: false };

describe("parentOf", () => {
  it("reads the Parent section", () => {
    expect(parentOf("## Parent\n\n#20\n\n## What to build")).toBe(20);
  });

  it("is undefined without one", () => {
    expect(parentOf("## Scope\n\nSee #20")).toBeUndefined();
  });
});

describe("blockersOf", () => {
  it.each([
    ["Blocked by: #15, #33", [15, 33]],
    ["Blocked by: #6, #7 (the migration step also needs #30)", [6, 7, 30]],
    ["Blocked by: None (can start immediately)", []],
    ["## Blocked by\n\n- #21\n- #23\n", [21, 23]],
    ["Mentions #4 but has no blockers", []],
  ])("reads %j", (body, expected) => {
    expect(blockersOf(body)).toEqual(expected);
  });
});

describe("summaryOf", () => {
  it("takes the first paragraph of What to build, skipping quotes and lists", () => {
    const body =
      "> **Grill this first.**\n\n## Parent\n\n#3\n\n## What to build\n\n- a list\n\nAmounts are **exact**, see [D145](x).\nSecond line.\n\nMore.";
    expect(summaryOf(body)).toBe("Amounts are exact, see D145. Second line.");
  });

  it("falls back to the Problem Statement and then to the intro", () => {
    expect(summaryOf("## Problem Statement\n\nUsers lose data.")).toBe("Users lose data.");
    expect(summaryOf("Plain intro.\n\n## Notes\n\nx")).toBe("Plain intro.");
    expect(summaryOf("Blocked by: #4")).toBeUndefined();
  });

  it("shortens a long paragraph at a word", () => {
    const summary = summaryOf(`## Summary\n\n${"word ".repeat(100)}`) ?? "";
    expect(summary.length).toBeLessThanOrEqual(322);
    expect(summary.endsWith("word …")).toBe(true);
  });
});

describe("historyOf", () => {
  it("counts created and built issues per day and fills empty days", () => {
    const history = historyOf([
      issue(1, {
        createdAt: "2026-11-07T10:00:00Z",
        state: "CLOSED",
        closedAt: "2026-11-09T08:00:00Z",
      }),
      issue(2, { createdAt: "2026-11-07T23:59:00Z" }),
      issue(3, { createdAt: "2026-11-09T01:00:00Z", closedAt: "2026-11-09T02:00:00Z" }),
    ]);
    expect(history).toEqual([
      { day: "2026-11-07", created: 2, built: 0 },
      { day: "2026-11-08", created: 0, built: 0 },
      { day: "2026-11-09", created: 1, built: 1 },
    ]);
  });

  it("is empty without dates", () => {
    expect(historyOf([issue(1)])).toEqual([]);
  });
});

describe("statusOf", () => {
  const specified = "## Problem Statement\n\nText";

  it("checks in the documented order", () => {
    const labelled = issue(1, { labels: ["needs-grilling", "ready-for-agent"], body: specified });
    expect(
      statusOf({ ...labelled, state: "CLOSED" }, { hasOpenPullRequest: true, hasChildren: true }),
    ).toBe("built");
    expect(statusOf(labelled, { hasOpenPullRequest: true, hasChildren: true })).toBe("review");
    expect(statusOf(labelled, { hasOpenPullRequest: false, hasChildren: true })).toBe("cut");
    expect(statusOf(labelled, free)).toBe("specified");
    expect(statusOf({ ...labelled, body: "" }, free)).toBe("grill");
    expect(statusOf(issue(1, { labels: ["ready-for-agent"] }), free)).toBe("buildable");
    expect(statusOf(issue(1, { labels: ["needs-triage"] }), free)).toBe("triage");
  });
});

describe("buildOverview", () => {
  const issues = [
    issue(1, {
      labels: ["layer:1", "ready-for-agent"],
      body: "## Problem Statement",
      state: "CLOSED",
    }),
    issue(2, { labels: ["layer:1"], body: "## Parent\n\n#1", state: "CLOSED" }),
    issue(3, { labels: ["layer:1", "needs-grilling"], body: "Blocked by: #1, #4" }),
    issue(4, { labels: ["layer:1", "ready-for-agent"] }),
    issue(5, { labels: ["needs-triage"] }),
  ];

  it("nests slices under their package and counts both", () => {
    const [one] = buildOverview(issues, new Map(), ROADMAP).layers;
    expect(one?.rows.map((row) => row.number)).toEqual([1, 3, 4]);
    expect(one?.rows[0]?.slices).toEqual([{ number: 2, title: "Issue 2", status: "built" }]);
    expect([one?.built, one?.total]).toEqual([2, 4]);
  });

  it("lists only open blockers", () => {
    const [one] = buildOverview(issues, new Map(), ROADMAP).layers;
    expect(one?.rows[1]?.waitingOn?.map((ref) => ref.number)).toEqual([4]);
  });

  it("names every blocker with its status in the details", () => {
    const [one] = buildOverview(issues, new Map(), ROADMAP).layers;
    expect(one?.rows[1]?.details?.blockers).toEqual([
      { number: 1, title: "Issue 1", status: "built" },
      { number: 4, title: "Issue 4", status: "buildable" },
    ]);
    expect(one?.rows[1]?.details?.labels).toEqual(["needs-grilling"]);
  });

  it("counts the statuses of each layer", () => {
    const [one] = buildOverview(issues, new Map(), ROADMAP).layers;
    expect(one?.statusCounts).toMatchObject({ built: 2, grill: 1, buildable: 1 });
  });

  it("treats the children of a layer spec as packages", () => {
    const withSpec = [
      issue(10, { labels: ["layer:1"], body: "## Problem Statement" }),
      issue(11, { labels: ["layer:1", "needs-grilling"], body: "## Parent\n\n#10" }),
      issue(12, { labels: ["layer:1", "ready-for-agent"], body: "## Parent\n\n#11" }),
    ];
    const [one] = buildOverview(withSpec, new Map(), ROADMAP).layers;
    expect(one?.specNumber).toBe(10);
    expect(one?.rows.map((row) => row.number)).toEqual([11]);
    expect(one?.rows[0]?.slices.map((slice) => slice.number)).toEqual([12]);
  });

  it("shows planned work for a layer without issues", () => {
    const [, two] = buildOverview(issues, new Map(), ROADMAP).layers;
    expect(two?.rows).toMatchObject([{ title: "Later work", status: "planned", note: "Open." }]);
  });

  it("collects issues without a known layer", () => {
    const last = buildOverview(issues, new Map(), ROADMAP).layers.at(-1);
    expect(last?.id).toBe("none");
    expect(last?.rows.map((row) => row.number)).toEqual([5]);
  });

  it("counts every issue once", () => {
    const { counts, total } = buildOverview(issues, new Map(), ROADMAP);
    expect(total).toBe(5);
    expect(counts).toMatchObject({ built: 2, grill: 1, buildable: 1, triage: 1 });
  });

  it("leaves out an issue closed as superseded", () => {
    const superseded = issue(6, {
      labels: ["layer:1"],
      state: "CLOSED",
      stateReason: "NOT_PLANNED",
    });
    const { total, layers } = buildOverview([...issues, superseded], new Map(), ROADMAP);
    expect(total).toBe(5);
    expect(layers[0]?.rows.map((row) => row.number)).not.toContain(6);
  });

  it("names the next steps", () => {
    const { nextSteps } = buildOverview(issues, new Map([[4, 9]]), ROADMAP);
    expect(nextSteps[0]).toContain("PR #9");
    expect(
      nextSteps.some((step) => step.startsWith("Nächstes Grilling") && step.includes("#3")),
    ).toBe(true);
  });

  it("offers only an unblocked ticket for building", () => {
    const blocked = [
      issue(1, { labels: ["ready-for-agent", "layer:1"], body: "Blocked by: #2" }),
      issue(2, { labels: ["ready-for-agent", "layer:1"] }),
    ];
    const step = buildOverview(blocked, new Map(), ROADMAP).nextSteps.find((text) =>
      text.startsWith("Baubar"),
    );
    expect(step).toContain("#2");
    expect(step).not.toContain("#1<");
  });
});

describe("renderPage", () => {
  it("escapes text that comes from issues", () => {
    const overview = buildOverview(
      [issue(1, { title: "<script>alert(1)</script>", labels: ["layer:1", "ready-for-agent"] })],
      new Map(),
      ROADMAP,
    );
    const page = renderPage(overview, "2026-11-10 08:00");
    expect(page).not.toContain("<script>alert(1)");
    expect(page).toContain(escapeHtml("<script>alert(1)</script>"));
    expect(page).toContain("2026-11-10 08:00");
  });

  it("names each slice in a tooltip and opens details for a package", () => {
    const overview = buildOverview(
      [
        issue(1, {
          labels: ["layer:1", "ready-for-agent"],
          body: "## What to build\n\nA <b> form.",
        }),
        issue(2, { title: "Child & co", labels: ["layer:1"], body: "## Parent\n\n#1" }),
      ],
      new Map(),
      ROADMAP,
    );
    const page = renderPage(overview, "now");
    expect(page).toContain('data-tip="Child &amp; co" data-sub="#2 · Triage offen"');
    expect(page).toContain('aria-controls="d-1"');
    expect(page).toContain("A &lt;b&gt; form.");
    expect(page).toContain('<span class="kc num">0/1</span>');
  });

  it("draws the history when issues have dates", () => {
    const overview = buildOverview(
      [issue(1, { labels: ["layer:1"], createdAt: "2026-11-07T10:00:00Z" })],
      new Map(),
      ROADMAP,
    );
    const page = renderPage(overview, "now");
    expect(page).toContain('data-tip="0 gebaut · 1 angelegt"');
    expect(page).toContain("Verlauf als Tabelle");
  });

  it("marks inline code in titles", () => {
    const overview = buildOverview(
      [issue(1, { title: "`time` package", labels: ["layer:1"] })],
      new Map(),
      ROADMAP,
    );
    expect(renderPage(overview, "now")).toContain('<span class="num">time</span> package');
  });
});

describe("the roadmap file", () => {
  it("names every layer once", () => {
    const roadmap = JSON.parse(readFileSync("docs/plan/roadmap.json", "utf8")) as Roadmap;
    const ids = roadmap.layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("3");
  });
});
