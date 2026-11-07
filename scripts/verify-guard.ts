// Claude Code PreToolUse hook (.claude/settings.json): blocks `git push` and `gh pr create`
// unless the last `pnpm verify` passed on the exact tree of HEAD. The hook reads the tool
// call as JSON on stdin; exit code 2 rejects it and shows stderr to the agent. Any other
// failure also exits 2, so a broken guard blocks instead of waving pushes through.
//
// Deleting a remote branch and dry runs publish nothing and pass through.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { headTreeHash, readVerifyStamp, type VerifyStamp } from "./verify-stamp.ts";

// A command starts a shell segment, after any `VAR=value` assignments. Matching only there
// keeps text that merely mentions `git push` (a commit message, an echo) from tripping it.
const SEGMENT_SEPARATOR = /&&|\|\||[;|&\n]|\$\(/;
const LEADING_ASSIGNMENTS = /^(?:[({]\s*)*(?:\w+=\S*\s+)*/;
const GIT_PUSH = /^git(?:\s+-[Cc]\s+\S+|\s+--[\w-]+(?:=\S+)?)*\s+push\b(?<args>.*)$/;
const GH_PR_CREATE = /^gh\s+pr\s+create\b/;
const DELETES_ONLY = /(?:^|\s)(?:--delete|-d)(?:\s|$)|(?:^|\s):\S+/;
const DRY_RUN = /(?:^|\s)(?:--dry-run|-n)(?:\s|$)/;

// Heredoc bodies are data (commit messages, file contents), never commands.
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g;

/** Whether a shell command publishes commits: a pushing `git push` or `gh pr create`. */
export function publishesCommits(command: string): boolean {
  const withoutHeredocs = command.replace(HEREDOC, (heredoc) => heredoc.split("\n")[0] ?? "");
  return withoutHeredocs.split(SEGMENT_SEPARATOR).some((segment) => {
    const invocation = segment.trim().replace(LEADING_ASSIGNMENTS, "");
    if (GH_PR_CREATE.test(invocation)) return true;
    const args = GIT_PUSH.exec(invocation)?.groups?.["args"];
    if (args === undefined) return false;
    return !DELETES_ONLY.test(args) && !DRY_RUN.test(args);
  });
}

/** Why the push is blocked, or `undefined` when the stamp covers HEAD. */
export function guardMessage(stamp: VerifyStamp | undefined, headTree: string): string | undefined {
  if (stamp?.tree === headTree) return undefined;
  const reason = stamp
    ? `it passed at ${stamp.verifiedAt} on different content than HEAD (commit, rebase or edit since)`
    : "there is no passing run for this checkout";
  return (
    `Blocked: \`pnpm verify\` must pass on the content being pushed, but ${reason}. ` +
    "Commit everything, run `pnpm verify` until it prints `VERIFY: PASS`, commit any " +
    "formatter output, then push again."
  );
}

function main(): void {
  const input = JSON.parse(readFileSync(0, "utf8")) as {
    readonly tool_input?: { readonly command?: unknown };
    readonly cwd?: string;
  };
  const command = input.tool_input?.command;
  if (typeof command !== "string" || !publishesCommits(command)) return;

  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: input.cwd ?? process.cwd(),
    encoding: "utf8",
  }).trim();
  const message = guardMessage(readVerifyStamp(root), headTreeHash(root));
  if (message) {
    console.error(message);
    process.exit(2);
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`Blocked: the push guard failed: ${String(error)}`);
    process.exit(2);
  }
}
