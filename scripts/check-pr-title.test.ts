import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { TITLE_TYPES, titleProblems } from "./check-pr-title.ts";

const script = fileURLToPath(new URL("./check-pr-title.ts", import.meta.url));
const skill = fileURLToPath(new URL("../.agents/skills/pr-convention/SKILL.md", import.meta.url));

describe("titleProblems", () => {
  it.each([
    // Titles already squash-merged on main.
    "chore: gate every change with pnpm verify and guard pushes",
    "chore: enforce module boundaries with dependency-cruiser",
    "docs(plan): finish layer 2 plan and link issues #29–#35 (D96–D98)",
    // The skill's own examples.
    "feat(desktop): edit tasks in a side panel without leaving the board",
    "fix(desktop): stop the calendar flickering while selecting a range",
    "perf(time): make long time-entry lists scroll smoothly",
    // Breaking changes, kebab-case scopes, every type.
    "feat!: drop the old import format",
    "refactor(oxlint-plugin)!: rename the rule options",
    ...TITLE_TYPES.map((type) => `${type}: do one thing`),
  ])("accepts %j", (title) => {
    expect(titleProblems(title)).toEqual([]);
  });

  it.each([
    ["no type", "add a ci workflow", "must look like"],
    ["an unknown type", "feature: add sync", 'type "feature" must be one of'],
    ["an uppercase type", "Fix: stop the crash", 'type "Fix" must be lowercase'],
    ["an uppercase scope", "fix(Desktop): stop the crash", 'scope "Desktop"'],
    ["an empty scope", "fix(): stop the crash", 'scope ""'],
    ["a scope with spaces", "fix(time entries): stop the crash", 'scope "time entries"'],
    ["no space after the colon", "fix:stop the crash", "one space after the colon"],
    ["two spaces after the colon", "fix:  stop the crash", "one space after the colon"],
    ["a space before the colon", "fix : stop the crash", "must look like"],
    ["an empty description", "fix: ", "must not be empty"],
    ["a capitalized description", "fix: Stop the crash", "must start lowercase"],
    ["a trailing period", "fix: stop the crash.", "must not end with a period"],
    ["trailing whitespace", "fix: stop the crash ", "must not end with whitespace"],
    ["German", "fix: Absturz beim Öffnen beheben", "must be English (found Ö)"],
    ["German, lowercase", "fix: größe der liste korrigieren", "must be English (found ö ß)"],
  ])("rejects %s", (_case, title, problem) => {
    const problems = titleProblems(title);
    expect(problems.join("\n")).toContain(problem);
  });

  it("reports every problem of a title at once", () => {
    expect(titleProblems("Feat(UI): Add a button.")).toHaveLength(4);
  });
});

describe("the title types", () => {
  it("are exactly the types in the pr-convention skill's table", () => {
    const tableTypes = readFileSync(skill, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .flatMap((line) => [...line.matchAll(/`([a-z]+):`/g)].map((match) => match[1]));
    const byName = (a = "", b = "") => a.localeCompare(b);
    expect(tableTypes.sort(byName)).toEqual([...TITLE_TYPES].sort(byName));
  });
});

describe("the check-pr-title command", () => {
  function run(env: Record<string, string>) {
    const { PR_TITLE: _ignored, ...rest } = process.env;
    return spawnSync(process.execPath, [script], { env: { ...rest, ...env }, encoding: "utf8" });
  }

  it("passes a good title from PR_TITLE", () => {
    const result = run({ PR_TITLE: "ci: run the verify gate and check pr titles" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok");
  });

  it("fails a bad title and names the problem", () => {
    const result = run({ PR_TITLE: "Fix the crash." });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must look like "type(scope): description"');
  });

  it("fails when PR_TITLE is missing", () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PR_TITLE is not set");
  });
});
