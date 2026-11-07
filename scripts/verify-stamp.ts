// The record of the last passing `pnpm verify`: the git tree of the checkout it verified.
// The push guard (verify-guard.ts) compares it with the tree of HEAD, so a push or PR goes
// out only after the gate passed on exactly that content.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

/** Relative to the checkout root; `.cache/` is gitignored. */
export const VERIFY_STAMP_FILE = ".cache/verify-stamp.json";

export interface VerifyStamp {
  readonly tree: string;
  readonly verifiedAt: string;
}

// Runs with the developer's full git config on purpose: `git add -A` must pick the same files
// as a real commit (global excludes, filters, autocrlf), or the stamp never matches HEAD.
function git(root: string, args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * The tree the checkout would commit with `git add -A`: tracked and untracked files, ignored
 * files left out. Built in a scratch copy of the index, so the real one stays untouched. The
 * blobs and trees it writes stay as loose objects in `.git/objects`; harmless, `git gc` prunes
 * them.
 */
export function workingTreeHash(root: string): string {
  const scratch = mkdtempSync(join(tmpdir(), "verify-stamp-"));
  try {
    const index = join(scratch, "index");
    const realIndex = resolve(root, git(root, ["rev-parse", "--git-path", "index"]));
    if (existsSync(realIndex)) copyFileSync(realIndex, index);
    git(root, ["add", "-A"], { GIT_INDEX_FILE: index });
    return git(root, ["write-tree"], { GIT_INDEX_FILE: index });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The tree of HEAD, which is what `git push` and `gh pr create` publish. */
export function headTreeHash(root: string): string {
  return git(root, ["rev-parse", "HEAD^{tree}"]);
}

export function writeVerifyStamp(root: string, stamp: VerifyStamp): void {
  const file = join(root, VERIFY_STAMP_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(stamp, null, 2)}\n`);
}

/** The stamp, or `undefined` when there is none or it is not a stamp. */
export function readVerifyStamp(root: string): VerifyStamp | undefined {
  const file = join(root, VERIFY_STAMP_FILE);
  if (!existsSync(file)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    // A half-written or hand-edited stamp counts as no passing run; the guard then blocks.
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "tree" in parsed &&
    "verifiedAt" in parsed &&
    typeof parsed.tree === "string" &&
    typeof parsed.verifiedAt === "string"
  ) {
    return { tree: parsed.tree, verifiedAt: parsed.verifiedAt };
  }
  return undefined;
}

export function clearVerifyStamp(root: string): void {
  rmSync(join(root, VERIFY_STAMP_FILE), { force: true });
}
