import { spawnSync } from "node:child_process";
import { realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestRepo, type TestRepo } from "./testing/git-repo.ts";
import { guardMessage, publishesCommits, publishTargets } from "./verify-guard.ts";
import { headTreeHash, writeVerifyStamp } from "./verify-stamp.ts";

describe("publishesCommits", () => {
  it.each([
    "git push",
    "git push -u origin chore/verify-gate",
    "git -C ../other push --force-with-lease",
    "pnpm verify && git push origin HEAD",
    "gh pr create --title 'chore: x' --body-file .temp/body.md",
    "GIT_TRACE=1 git push",
    "git status\ngit push",
    "(git push)",
    "git push 2>&1 | tail -5",
    "cat > .temp/body.md <<'EOF'\nbody\nEOF\ngh pr create --body-file .temp/body.md",
    // Shell keywords and wrappers in front of the command.
    "if pnpm verify; then git push; fi",
    "for b in a; do git push origin $b; done",
    "while true; do git push; done",
    "! git push",
    "command git push",
    "exec git push",
    "env git push",
    "env GIT_TRACE=1 git push",
    "time git push",
    "nohup git push &",
    // A nested shell, and a git binary by path.
    "sh -c 'git push'",
    'bash -lc "git push -u origin HEAD"',
    "/bin/zsh -c 'pnpm verify && git push'",
    "/opt/homebrew/bin/git push",
    "/opt/homebrew/bin/gh pr create --fill",
    // Deleting one ref while pushing another.
    "git push origin main :old-branch",
  ])("guards %j", (command) => {
    expect(publishesCommits(command)).toBe(true);
  });

  it.each([
    "git status",
    "git push origin --delete old-branch",
    "git push --delete origin old-branch",
    "git push origin :old-branch",
    "git push origin :old-branch :older-branch",
    "git push --dry-run",
    "gh pr view 123",
    "git log --grep push",
    "sh -c 'git status'",
    "bash script.sh",
    "cat > AGENTS.md <<'EOF'\nA hook blocks `git push` and `gh pr create` until it passes.\nEOF",
    "git commit -m 'block git push without verify'",
    "git commit -F - <<'EOF'\nchore: guard\n\n  git push / gh pr create stay blocked\nEOF",
  ])("lets %j through", (command) => {
    expect(publishesCommits(command)).toBe(false);
  });
});

describe("publishTargets", () => {
  const cwd = resolve("/repo/sub");

  it("targets the hook's cwd by default", () => {
    expect(publishTargets("git push", cwd)).toEqual([cwd]);
    expect(publishTargets("gh pr create --fill", cwd)).toEqual([cwd]);
    expect(publishTargets("sh -c 'git push'", cwd)).toEqual([cwd]);
  });

  it("targets the `-C` directory, resolved against cwd", () => {
    expect(publishTargets("git -C ../other push", cwd)).toEqual([resolve("/repo/other")]);
    expect(publishTargets("git -C /abs -C nested push", cwd)).toEqual([resolve("/abs/nested")]);
    expect(publishTargets('git -C "/with space" push', cwd)).toEqual([resolve("/with space")]);
    expect(publishTargets("git -c push.default=simple push", cwd)).toEqual([cwd]);
  });

  it("lists every target once", () => {
    const command = "git push && git -C . push && git -C ../other push origin main";
    expect(publishTargets(command, cwd)).toEqual([cwd, resolve("/repo/other")]);
  });

  it("is empty for a command that publishes nothing", () => {
    expect(publishTargets("git -C ../other status", cwd)).toEqual([]);
  });
});

describe("guardMessage", () => {
  const stamp = { tree: "abc", verifiedAt: "2026-11-08T08:00:00.000Z" };

  it("allows a push of the verified tree", () => {
    expect(guardMessage(stamp, "abc")).toBeUndefined();
  });

  it("blocks without a passing run", () => {
    expect(guardMessage(undefined, "abc")).toContain("no passing run");
  });

  it("blocks when HEAD changed since the passing run", () => {
    expect(guardMessage(stamp, "def")).toContain("different content than HEAD");
  });
});

describe("the hook", () => {
  const GUARD = resolve(import.meta.dirname, "verify-guard.ts");
  let repo: TestRepo;

  beforeEach(() => {
    repo = createTestRepo("verify-guard-test-");
  });

  afterEach(() => {
    repo.remove();
  });

  /** Runs the hook as Claude Code does: the tool call as JSON on stdin. */
  function runHook(command: string, cwd: string): { status: number | null; stderr: string } {
    const result = spawnSync(process.execPath, [GUARD], {
      input: JSON.stringify({ tool_input: { command }, cwd }),
      encoding: "utf8",
    });
    return { status: result.status, stderr: result.stderr };
  }

  function stampHead(target: TestRepo): void {
    writeVerifyStamp(target.dir, {
      tree: headTreeHash(target.dir),
      verifiedAt: "2026-11-08T08:00:00.000Z",
    });
  }

  it("blocks a push without a stamp, and allows it once the stamp covers HEAD", () => {
    const blocked = runHook("git push", repo.dir);
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain("no passing run");

    stampHead(repo);
    expect(runHook("git push", repo.dir).status).toBe(0);
  });

  it("blocks again after a new commit", () => {
    stampHead(repo);
    writeFileSync(join(repo.dir, "a.txt"), "changed\n");
    repo.git("commit", "-q", "-am", "edit");
    const blocked = runHook("git push", repo.dir);
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain("different content than HEAD");
  });

  it("lets a non-publishing command through without a stamp", () => {
    expect(runHook("git status", repo.dir).status).toBe(0);
  });

  it("judges `git -C <dir> push` by that repository, not the session's", () => {
    const other = createTestRepo("verify-guard-test-other-");
    try {
      stampHead(repo);
      const blocked = runHook(`git -C ${JSON.stringify(other.dir)} push`, repo.dir);
      expect(blocked.status).toBe(2);
      // The guard names the repository root as git resolves it (macOS: /private/var/...).
      expect(blocked.stderr).toContain(realpathSync(other.dir));
      expect(runHook(`git -C ${JSON.stringify(repo.dir)} push`, other.dir).status).toBe(0);
    } finally {
      other.remove();
    }
  });
});
