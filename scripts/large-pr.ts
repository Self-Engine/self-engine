// The size check of a pull request (.github/workflows/large-pr.yml). A large pull request gets a
// review by CodeRabbit and an app check before it merges (docs/agents/workflow.md, "Large pull
// requests"); this script says whether a pull request is large. It reads the changed files from
// the JSON lines at `PR_FILES`, as `gh api …/pulls/<n>/files --jq '.[] | {filename, additions,
// deletions}'` writes them, and writes `large=true` or `large=false` to `GITHUB_OUTPUT`.

import { appendFileSync, readFileSync } from "node:fs";

/** From this many changed lines on, not counting generated files, a pull request is large. */
export const LARGE_PR_LINES = 1000;

/** One changed file of a pull request, as the GitHub API lists it. */
export interface ChangedFile {
  readonly filename: string;
  readonly additions: number;
  readonly deletions: number;
}

/** Files a tool writes: lockfiles and the extracted translation catalogs. */
export function isGenerated(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name === "pnpm-lock.yaml" || name === "bun.lock") return true;
  return /^packages\/i18n\/src\/locales\/[^/]+\.po$/u.test(path);
}

/** The added and deleted lines of `files`, without generated files. */
export function changedLines(files: readonly ChangedFile[]): number {
  return files
    .filter((file) => !isGenerated(file.filename))
    .reduce((sum, file) => sum + file.additions + file.deletions, 0);
}

export function isLarge(files: readonly ChangedFile[]): boolean {
  return changedLines(files) >= LARGE_PR_LINES;
}

/** The changed files in JSON lines; fails naming the first line that is no changed file. */
export function parseChangedFiles(text: string): ChangedFile[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      const value: unknown = JSON.parse(line);
      if (
        typeof value === "object" &&
        value !== null &&
        "filename" in value &&
        typeof value.filename === "string" &&
        "additions" in value &&
        typeof value.additions === "number" &&
        "deletions" in value &&
        typeof value.deletions === "number"
      ) {
        return { filename: value.filename, additions: value.additions, deletions: value.deletions };
      }
      throw new Error(`Line ${index + 1} is no changed file: ${line}`);
    });
}

function main(): void {
  const path = process.env.PR_FILES;
  if (path === undefined) {
    console.error("large-pr: PR_FILES is not set");
    process.exit(1);
  }
  const files = parseChangedFiles(readFileSync(path, "utf8"));
  const lines = changedLines(files);
  const large = lines >= LARGE_PR_LINES;
  console.log(
    `large-pr: ${lines} changed lines without generated files (limit ${LARGE_PR_LINES}): ${large ? "large" : "not large"}`,
  );
  const output = process.env.GITHUB_OUTPUT;
  if (output !== undefined) appendFileSync(output, `large=${large}\n`);
}

if (import.meta.main) main();
