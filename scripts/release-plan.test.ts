import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  formatPlan,
  nextStableVersion,
  nightlyDate,
  planNightly,
  planStable,
  type ReleaseTag,
  readTags,
  runReleasePlan,
} from "./release-plan.ts";
import { createTestRepo, type TestRepo } from "./testing/git-repo.ts";

const COMMIT = "a".repeat(40);
const OTHER = "b".repeat(40);
const tag = (name: string, commit = OTHER): ReleaseTag => ({ name, commit });

describe("nextStableVersion", () => {
  it("is the package version before the first stable", () => {
    expect(nextStableVersion([], "0.0.1")).toBe("0.0.1");
  });

  it("is always a patch bump of the last stable", () => {
    expect(nextStableVersion([tag("v0.0.1")], "0.0.1")).toBe("0.0.2");
    expect(nextStableVersion([tag("v0.1.0"), tag("v0.0.9")], "0.0.1")).toBe("0.1.1");
  });

  it("orders stable tags numerically", () => {
    expect(nextStableVersion([tag("v0.0.9"), tag("v0.0.10")], "0.0.1")).toBe("0.0.11");
  });

  it("ignores nightly tags", () => {
    expect(nextStableVersion([tag("v0.5.0-nightly.20261108.3")], "0.0.1")).toBe("0.0.1");
  });

  it("refuses a package version that is not x.y.z", () => {
    expect(() => nextStableVersion([], "0.0.1-rc.1")).toThrow(/not x\.y\.z/);
  });
});

describe("nightlyDate", () => {
  it("is the UTC date", () => {
    expect(nightlyDate("2026-11-08T03:12:45Z")).toBe("20261108");
    expect(nightlyDate("2026-11-08T23:30:00-05:00")).toBe("20261109");
  });

  it("refuses a value that is no timestamp", () => {
    expect(() => nightlyDate("soon")).toThrow(/not a timestamp/);
  });
});

describe("planNightly", () => {
  const input = {
    tags: [] as ReleaseTag[],
    packageVersion: "0.0.1",
    commit: COMMIT,
    startedAt: "2026-11-08T03:12:45Z",
    runNumber: 7,
  };

  it("names the version <base>-nightly.<date>.<run>", () => {
    expect(planNightly(input)).toEqual({
      channel: "nightly",
      version: "0.0.1-nightly.20261108.7",
      tag: "v0.0.1-nightly.20261108.7",
      commit: COMMIT,
      previousTag: "",
      changed: true,
    });
  });

  it("bases on the next stable once one exists, so a nightly is newer than it", () => {
    const plan = planNightly({ ...input, tags: [tag("v0.0.1", COMMIT)] });
    expect(plan.version).toBe("0.0.2-nightly.20261108.7");
  });

  it("is unchanged when the commit is the last nightly's", () => {
    const tags = [tag("v0.0.1-nightly.20261107.6", COMMIT)];
    expect(planNightly({ ...input, tags }).changed).toBe(false);
  });

  it("is changed when main moved on", () => {
    const tags = [tag("v0.0.1-nightly.20261107.6", OTHER)];
    expect(planNightly({ ...input, tags })).toMatchObject({
      changed: true,
      previousTag: "v0.0.1-nightly.20261107.6",
    });
  });

  it("compares against the newest nightly by date and run", () => {
    const tags = [
      tag("v0.0.1-nightly.20261107.9", OTHER),
      tag("v0.0.1-nightly.20261107.10", COMMIT),
      tag("v0.0.1-nightly.20261106.11", OTHER),
    ];
    expect(planNightly({ ...input, tags }).changed).toBe(false);
  });

  it.each([
    ["abc", 1],
    [COMMIT, 0],
    [COMMIT, 1.5],
    [COMMIT, Number.NaN],
  ])("refuses commit %j with run %j", (commit, runNumber) => {
    expect(() => planNightly({ ...input, commit, runNumber })).toThrow();
  });
});

describe("planStable", () => {
  const input = { packageVersion: "0.0.1", requestedVersion: "" };

  it("needs a published nightly", () => {
    expect(() => planStable({ ...input, tags: [tag("v0.0.1")] })).toThrow(/published nightly/);
  });

  it("builds the commit of the latest published nightly", () => {
    const tags = [
      tag("v0.0.1-nightly.20261106.5", OTHER),
      tag("v0.0.1-nightly.20261108.7", COMMIT),
      tag("v0.0.1-nightly.20261107.6", OTHER),
    ];
    expect(planStable({ ...input, tags })).toEqual({
      channel: "stable",
      version: "0.0.1",
      tag: "v0.0.1",
      commit: COMMIT,
      previousTag: "",
      changed: true,
    });
  });

  it("proposes a patch bump after the last stable and starts its changelog there", () => {
    const tags = [tag("v0.0.2-nightly.20261108.7", COMMIT), tag("v0.0.1", OTHER)];
    expect(planStable({ ...input, tags })).toMatchObject({
      version: "0.0.2",
      previousTag: "v0.0.1",
    });
  });

  it("takes a version the owner raised deliberately", () => {
    const tags = [tag("v0.0.2-nightly.20261108.7", COMMIT), tag("v0.0.1", OTHER)];
    expect(planStable({ ...input, tags, requestedVersion: "0.1.0" }).version).toBe("0.1.0");
  });

  it("accepts a leading v", () => {
    const tags = [tag("v0.0.1-nightly.20261108.7", COMMIT)];
    expect(planStable({ ...input, tags, requestedVersion: "v0.2.0" }).tag).toBe("v0.2.0");
  });

  it.each(["0.1", "1.0.0-rc.1", "latest; rm -rf /"])("refuses the version %j", (version) => {
    const tags = [tag("v0.0.1-nightly.20261108.7", COMMIT)];
    expect(() => planStable({ ...input, tags, requestedVersion: version })).toThrow(/x\.y\.z/);
  });

  it.each(["0.1.0", "0.0.9"])("refuses %s when it is not above the last stable", (version) => {
    const tags = [tag("v0.0.2-nightly.20261108.7", COMMIT), tag("v0.1.0", OTHER)];
    expect(() => planStable({ ...input, tags, requestedVersion: version })).toThrow(/not higher/);
  });
});

describe("formatPlan", () => {
  it("writes one key=value per line", () => {
    const plan = planNightly({
      tags: [],
      packageVersion: "0.0.1",
      commit: COMMIT,
      startedAt: "2026-11-08T03:12:45Z",
      runNumber: 7,
    });
    expect(formatPlan(plan)).toBe(
      `channel=nightly\nversion=0.0.1-nightly.20261108.7\ntag=v0.0.1-nightly.20261108.7\ncommit=${COMMIT}\nprevious_tag=\nchanged=true\n`,
    );
  });
});

describe("the release plan from a repository", () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.remove();
    repo = undefined;
  });

  function checkout() {
    const created = createTestRepo("release-plan-");
    repo = created;
    mkdirSync(join(created.dir, "apps/desktop"), { recursive: true });
    writeFileSync(join(created.dir, "apps/desktop/package.json"), '{ "version": "0.0.1" }\n');
    return { dir: created.dir, git: (...args: string[]) => created.git(...args) };
  }

  it("reads lightweight and annotated tags as commits, and ignores other tags", () => {
    const { dir, git } = checkout();
    const commit = git("rev-parse", "HEAD");
    git("tag", "v0.0.1-nightly.20261108.1");
    git("tag", "-a", "v0.0.1", "-m", "stable");
    git("tag", "other");
    expect(readTags(dir).toSorted((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "v0.0.1", commit },
      { name: "v0.0.1-nightly.20261108.1", commit },
    ]);
  });

  it("writes the plan to GITHUB_OUTPUT and prints it", () => {
    const { dir, git } = checkout();
    const commit = git("rev-parse", "HEAD");
    const outputFile = join(dir, "github-output");
    const printed: string[] = [];
    runReleasePlan(
      ["nightly", "--commit", commit, "--started-at", "2026-11-08T03:12:45Z", "--run-number", "7"],
      { cwd: dir, env: { GITHUB_OUTPUT: outputFile }, print: (line) => printed.push(line) },
    );
    const output = readFileSync(outputFile, "utf8");
    expect(output).toContain("version=0.0.1-nightly.20261108.7\n");
    expect(printed.join("\n")).toBe(output.trimEnd());
  });

  it("plans a stable of the latest nightly tag", () => {
    const { dir, git } = checkout();
    git("tag", "v0.0.1-nightly.20261108.1");
    const printed: string[] = [];
    runReleasePlan(["stable"], { cwd: dir, env: {}, print: (line) => printed.push(line) });
    expect(printed.join("\n")).toContain(`commit=${git("rev-parse", "HEAD")}`);
    expect(printed.join("\n")).toContain("version=0.0.1");
  });

  it("names the channel it needs", () => {
    const { dir } = checkout();
    expect(() => runReleasePlan([], { cwd: dir, env: {}, print: () => {} })).toThrow(
      /Name the channel/,
    );
  });
});
