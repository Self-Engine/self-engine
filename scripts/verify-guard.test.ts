import { describe, expect, it } from "vite-plus/test";
import { guardMessage, publishesCommits } from "./verify-guard.ts";

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
  ])("guards %j", (command) => {
    expect(publishesCommits(command)).toBe(true);
  });

  it.each([
    "git status",
    "git push origin --delete old-branch",
    "git push origin :old-branch",
    "git push --dry-run",
    "gh pr view 123",
    "git log --grep push",
    "cat > AGENTS.md <<'EOF'\nA hook blocks `git push` and `gh pr create` until it passes.\nEOF",
    "git commit -m 'block git push without verify'",
    "git commit -F - <<'EOF'\nchore: guard\n\n  git push / gh pr create stay blocked\nEOF",
  ])("lets %j through", (command) => {
    expect(publishesCommits(command)).toBe(false);
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
