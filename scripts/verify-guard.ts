// Claude Code PreToolUse hook (.claude/settings.json): blocks `git push` and `gh pr create`
// unless the last `pnpm verify` passed on the exact tree of HEAD in the repository the
// command publishes from. The hook reads the tool call as JSON on stdin; exit code 2 rejects
// it and shows stderr to the agent, and Claude Code treats every other exit code as
// "continue". So the script exits 2 when it fails itself, and the hook command in
// settings.json appends `|| exit 2` for when it cannot even start (no `node` on PATH, no
// `CLAUDE_PROJECT_DIR`): a broken guard blocks instead of waving pushes through.
//
// Deleting a remote branch and dry runs publish nothing and pass through.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { headTreeHash, readVerifyStamp, type VerifyStamp } from "./verify-stamp.ts";

// A command starts a shell segment. Matching only there keeps text that merely mentions
// `git push` (a commit message, an echo) from tripping the guard.
const SEGMENT_SEPARATOR = /&&|\|\||[;|&\n]|\$\(/;
// What may precede the command in its segment: grouping, negation, `VAR=value` assignments,
// control keywords (`if x; then git push; fi`) and wrappers that run their argument.
const LEADING_NOISE =
  /^(?:[({]\s*|!\s+|\w+=\S*\s+|(?:if|then|elif|else|do|while|until|command|exec|env|time|nohup)\s+)*/;
// A shell with `-c` runs its quoted argument as a command line of its own.
const SHELL_C =
  /^(?:\S*\/)?(?:sh|bash|zsh|dash)(?<flags>(?:\s+-\S+)*)\s+(?:'(?<single>[^']*)'|"(?<double>(?:[^"\\]|\\.)*)")/;
const SHELL_C_FLAG = /(?:^|\s)-\w*c\b/;
const QUOTED_OR_WORD = /"[^"]*"|'[^']*'|\S+/;
const GIT_PUSH = new RegExp(
  `^(?:\\S*/)?git(?<options>(?:\\s+-[Cc]\\s+(?:${QUOTED_OR_WORD.source})|\\s+--[\\w-]+(?:=\\S+)?)*)\\s+push\\b(?<args>.*)$`,
);
const GIT_C_DIR = new RegExp(`\\s-C\\s+(${QUOTED_OR_WORD.source})`, "g");
const GH_PR_CREATE = /^(?:\S*\/)?gh\s+pr\s+create\b/;
const DRY_RUN = /(?:^|\s)(?:--dry-run|-n)(?:\s|$)/;

// Heredoc bodies are data (commit messages, file contents), never commands.
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g;

/**
 * The directories whose repositories a shell command publishes from, each once: `cwd` for
 * `gh pr create` and a plain `git push`, or the `-C <dir>` of a `git -C <dir> push`, resolved
 * against `cwd`. Empty when the command publishes nothing.
 */
export function publishTargets(command: string, cwd: string): string[] {
  const withoutHeredocs = command.replace(HEREDOC, (heredoc) => heredoc.split("\n")[0] ?? "");
  const targets = new Set<string>();
  for (const segment of withoutHeredocs.split(SEGMENT_SEPARATOR)) {
    const invocation = segment.trim().replace(LEADING_NOISE, "");
    const shell = SHELL_C.exec(invocation)?.groups;
    if (shell && SHELL_C_FLAG.test(shell["flags"] ?? "")) {
      const body = shell["single"] ?? shell["double"] ?? "";
      for (const target of publishTargets(body, cwd)) targets.add(target);
    } else if (GH_PR_CREATE.test(invocation)) {
      targets.add(cwd);
    } else {
      const push = GIT_PUSH.exec(invocation)?.groups;
      const args = push?.["args"] ?? "";
      if (push && !deletesOnly(args) && !DRY_RUN.test(args)) {
        targets.add(gitDirectory(push["options"] ?? "", cwd));
      }
    }
  }
  return [...targets];
}

/** Whether a shell command publishes commits from anywhere. */
export function publishesCommits(command: string): boolean {
  return publishTargets(command, "/").length > 0;
}

/**
 * Whether `git push <args>` only deletes remote refs: `--delete`/`-d` is given, or every
 * refspec after the remote is a `:<ref>`. `git push origin main :old` still pushes `main`.
 */
function deletesOnly(args: string): boolean {
  const words = args.split(/\s+/).filter((word) => word !== "");
  if (words.some((word) => word === "--delete" || word === "-d")) return true;
  const [, ...refspecs] = words.filter((word) => !word.startsWith("-"));
  return refspecs.length > 0 && refspecs.every((refspec) => refspec.startsWith(":"));
}

/** Where `git` with these global options runs: each `-C <dir>` applied in turn, from `cwd`. */
function gitDirectory(options: string, cwd: string): string {
  const dirs = [...options.matchAll(GIT_C_DIR)].map((match) => unquote(match[1] ?? ""));
  return resolve(cwd, ...dirs);
}

function unquote(word: string): string {
  return /^(['"]).*\1$/.test(word) ? word.slice(1, -1) : word;
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

function repoRoot(dir: string): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: dir,
    encoding: "utf8",
  }).trim();
}

function main(): void {
  const input = JSON.parse(readFileSync(0, "utf8")) as {
    readonly tool_input?: { readonly command?: unknown };
    readonly cwd?: string;
  };
  const command = input.tool_input?.command;
  if (typeof command !== "string") return;
  // Every targeted repository must have a passing run on its HEAD, not just the session's.
  for (const target of publishTargets(command, input.cwd ?? process.cwd())) {
    const root = repoRoot(target);
    const message = guardMessage(readVerifyStamp(root), headTreeHash(root));
    if (message) {
      console.error(`${root}: ${message}`);
      process.exit(2);
    }
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
