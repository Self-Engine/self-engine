// The changelog of a stable release (ADR 0007): the Conventional Commit subjects since the last
// stable tag. PRs are squash-merged, so each subject is a PR title that CI already checked
// (scripts/check-pr-title.ts); which types are listed is the pr-convention skill's table.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseTitle } from "./check-pr-title.ts";

const SECTIONS: readonly { readonly title: string; readonly types: readonly string[] }[] = [
  { title: "Features", types: ["feat"] },
  { title: "Bug Fixes", types: ["fix"] },
  { title: "Performance", types: ["perf"] },
  { title: "Other Changes", types: ["refactor", "revert"] },
];

/** Markdown for `subjects`, newest first; hidden types and non-conventional subjects drop out. */
export function renderChangelog(subjects: readonly string[]): string {
  const titles = subjects.flatMap((subject) => parseTitle(subject) ?? []);
  const sections = SECTIONS.flatMap(({ title, types }) => {
    const entries = titles.filter(({ type }) => types.includes(type));
    if (entries.length === 0) return [];
    const lines = entries.map(({ scope, breaking, description }) => {
      const prefix = `${breaking ? "**BREAKING** " : ""}${scope === undefined ? "" : `**${scope}:** `}`;
      return `- ${prefix}${description}`;
    });
    return [`## ${title}\n\n${lines.join("\n")}`];
  });
  return sections.length === 0 ? "No user-facing changes.\n" : `${sections.join("\n\n")}\n`;
}

/** The commit subjects after `from` (a tag, or empty for the whole history) up to `to`. */
export function readSubjects(cwd: string, from: string, to: string): string[] {
  const range = from === "" ? to : `${from}..${to}`;
  return execFileSync("git", ["log", "--format=%s", range], { cwd, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

export function runChangelog(argv: string[], cwd: string): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      from: { type: "string", default: "" },
      to: { type: "string" },
      output: { type: "string" },
    },
  });
  if (values.to === undefined || values.output === undefined) {
    throw new Error("Usage: release-changelog --to <commit> --output <file> [--from <tag>]");
  }
  writeFileSync(values.output, renderChangelog(readSubjects(cwd, values.from, values.to)));
}

if (import.meta.main) {
  try {
    runChangelog(process.argv.slice(2), process.cwd());
  } catch (error) {
    console.error(`release-changelog: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
