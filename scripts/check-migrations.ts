// The migrations stage of `pnpm verify` (D142): a migration that has reached `main` may not be
// changed, deleted or renamed, because every state of `main` ships as a Nightly and may have run
// on real data. Adding one is fine. It compares the working tree with the merge base, so main
// moving on is not mistaken for a deletion and an edit not yet committed is caught.
//
// On `main` itself the merge base is HEAD, so CI's push run compares nothing: the pull request
// was checked on its way in, and branch protection allows no other way in.
//
// The result depends on git history, which Vite Task's cache cannot see, so the stage is
// uncached (vite.config.ts). Without the history it fails: a guard that cannot compare must not
// report that nothing changed.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/** `main` as it was pushed, which is what ships; a local `main` can hold anything. */
const MAIN = "origin/main";

/** The `<four digits>.sql` files that `defineMigrations` accepts, in any `migrations` folder. */
const MIGRATION_FILE = /(?:^|\/)migrations\/\d{4}\.sql$/;

/** Fixtures in a package's or app's `test` folder never ship, so they never ran anywhere. */
const TEST_FOLDER = /^(?:apps|packages)\/[^/]+\/test\//;

const MISSING_HISTORY =
  `needs the history of main, but found no merge base of HEAD and ${MAIN} (shallow clone, ` +
  "missing ref, or unrelated history). Locally run `git fetch --unshallow origin` or " +
  "`git fetch origin main`; in CI the checkout needs `fetch-depth: 0`.";

/** The trimmed output of a git command, or `undefined` when it did not succeed. */
function git(root: string, args: readonly string[]): string | undefined {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

/** `git diff -z --name-status <base>` of the working tree, or `undefined` without the history. */
function diffAgainstMergeBase(root: string): string | undefined {
  if (git(root, ["rev-parse", "--is-shallow-repository"]) !== "false") return undefined;
  const base = git(root, ["merge-base", "HEAD", `refs/remotes/${MAIN}`]);
  // `--no-renames`: a rename is a deletion of the merged file, whatever its new name is.
  return base === undefined
    ? undefined
    : git(root, ["diff", "--name-status", "--no-renames", "-z", base, "--"]);
}

function isMigration(path: string): boolean {
  return MIGRATION_FILE.test(path) && !TEST_FOLDER.test(path);
}

/**
 * The merged migrations the working tree changes, as `<path>: <what>`, or one line saying the
 * history is missing.
 */
export function findMigrationProblems(root: string): string[] {
  const diff = diffAgainstMergeBase(root);
  if (diff === undefined) return [MISSING_HISTORY];

  const fields = diff.split("\0");
  const problems: string[] = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if (path === undefined || status === "A" || !isMigration(path)) continue;
    const what = status === "D" ? "deleted or renamed" : "changed";
    problems.push(`${path}: ${what} after it reached main. Write a new migration instead.`);
  }
  return problems;
}

function main(): void {
  const root = process.argv[2] ?? resolve(import.meta.dirname, "..");
  const problems = findMigrationProblems(root);
  if (problems.length > 0) {
    console.error(`check-migrations:\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log("check-migrations: ok");
}

if (import.meta.main) main();
