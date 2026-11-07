import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ADR_STATUSES = ["proposed", "accepted", "deprecated", "superseded"] as const;

const ADR_DIR = "docs/adr";
const ADR_NAME = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;
const STATUS_LINE = /^status:\s*(\S+)\s*$/m;

export interface AdrFile {
  name: string;
  content: string;
}

/**
 * Rules for the ADR files in `docs/adr/` (see docs/agents/domain.md):
 * - every file is named `<4-digit number>-<kebab-slug>.md`;
 * - no two files share a number (parallel branches each taking "the next number" is how
 *   duplicates arise, so a rebase onto main surfaces them here);
 * - every file opens with YAML front matter that holds a known `status:`.
 */
export function findAdrProblems(files: readonly AdrFile[]): string[] {
  const problems: string[] = [];
  const byNumber = new Map<string, string[]>();
  for (const { name, content } of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    const number = ADR_NAME.exec(name)?.[1];
    if (number === undefined) {
      problems.push(`${name}: name must match <4-digit number>-<kebab-case-slug>.md`);
    } else {
      byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
    }
    problems.push(...findStatusProblems(name, content));
  }
  for (const [number, names] of byNumber) {
    if (names.length > 1) {
      problems.push(
        `ADR ${number} is used by ${names.join(", ")}: give the newer one the next free number`,
      );
    }
  }
  return problems;
}

function findStatusProblems(name: string, content: string): string[] {
  const frontMatter = FRONT_MATTER.exec(content.replaceAll("\r\n", "\n"))?.[1];
  if (frontMatter === undefined) {
    return [`${name}: must open with YAML front matter (--- … ---) that holds a status`];
  }
  const status = STATUS_LINE.exec(frontMatter)?.[1];
  if (status === undefined) {
    return [`${name}: front matter needs a status: line`];
  }
  if (!(ADR_STATUSES as readonly string[]).includes(status)) {
    return [`${name}: status "${status}" must be one of ${ADR_STATUSES.join(", ")}`];
  }
  return [];
}

function main(): void {
  const dir = resolve(import.meta.dirname, "..", ADR_DIR);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({ name, content: readFileSync(resolve(dir, name), "utf8") }));
  const problems = findAdrProblems(files);
  if (problems.length > 0) {
    console.error(`check-adrs:\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`check-adrs: ${files.length} ADRs ok`);
}

if (import.meta.main) main();
