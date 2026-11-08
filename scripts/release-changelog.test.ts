import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { readSubjects, renderChangelog, runChangelog } from "./release-changelog.ts";
import { createTestRepo, type TestRepo } from "./testing/git-repo.ts";

describe("renderChangelog", () => {
  it("groups by the pr-convention table and keeps commit order inside a section", () => {
    expect(
      renderChangelog([
        "feat(desktop): open the app in a window (#43)",
        "fix(time): keep the running timer (#12)",
        "perf: start faster (#9)",
        "refactor(ui): share the form (#8)",
        "feat: export a report (#7)",
      ]),
    ).toBe(
      [
        "## Features",
        "",
        "- **desktop:** open the app in a window (#43)",
        "- export a report (#7)",
        "",
        "## Bug Fixes",
        "",
        "- **time:** keep the running timer (#12)",
        "",
        "## Performance",
        "",
        "- start faster (#9)",
        "",
        "## Other Changes",
        "",
        "- **ui:** share the form (#8)",
        "",
      ].join("\n"),
    );
  });

  it("hides what the convention hides", () => {
    const hidden = ["docs: a", "chore: b", "test: c", "build: d", "ci: e"];
    expect(renderChangelog(hidden)).toBe("No user-facing changes.\n");
  });

  it("drops subjects that are not conventional", () => {
    expect(renderChangelog(["Merge branch main", "init"])).toBe("No user-facing changes.\n");
  });

  it("marks a breaking change", () => {
    expect(renderChangelog(["feat(time)!: drop the old format"])).toContain(
      "- **BREAKING** **time:** drop the old format",
    );
  });
});

describe("reading the commits", () => {
  let repo: TestRepo | undefined;

  afterEach(() => {
    repo?.remove();
    repo = undefined;
  });

  function history(): TestRepo {
    repo = createTestRepo("release-changelog-");
    repo.git("commit", "-q", "--allow-empty", "-m", "fix: before the tag");
    repo.git("tag", "v0.0.1");
    repo.git("commit", "-q", "--allow-empty", "-m", "feat: after the tag");
    return repo;
  }

  it("starts after the given tag", () => {
    const { dir } = history();
    expect(readSubjects(dir, "v0.0.1", "HEAD")).toEqual(["feat: after the tag"]);
  });

  it("reads the whole history before the first stable", () => {
    const { dir } = history();
    expect(readSubjects(dir, "", "HEAD")).toEqual([
      "feat: after the tag",
      "fix: before the tag",
      "init",
    ]);
  });

  it("writes the changelog to the output file", () => {
    const { dir } = history();
    const output = join(dir, "notes.md");
    runChangelog(["--from", "v0.0.1", "--to", "HEAD", "--output", output], dir);
    expect(readFileSync(output, "utf8")).toBe("## Features\n\n- after the tag\n");
  });

  it("takes an empty --from, which the workflow passes before the first stable", () => {
    const { dir } = history();
    const output = join(dir, "notes.md");
    runChangelog(["--from", "", "--to", "HEAD", "--output", output], dir);
    expect(readFileSync(output, "utf8")).toContain("## Bug Fixes");
  });

  it("needs a target and a file", () => {
    const { dir } = history();
    expect(() => runChangelog([], dir)).toThrow(/Usage/);
  });
});
