// The size label of a pull request (.github/workflows/pr-size.yml). Every pull request carries
// exactly one `size:*` label; `size:XXL` asks for a CodeRabbit review and an app check before
// the merge (docs/agents/workflow.md, "Large pull requests").
//
// `node scripts/pr-size.ts <base> <head>` counts the lines `<base>...<head>` changes and writes
// `label=<name>` to `GITHUB_OUTPUT`. `node scripts/pr-size.ts labels` prints every label as
// `name<TAB>color<TAB>description`, so the workflow keeps their definitions in step.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export interface SizeLabel {
  readonly name: string;
  /** Changed lines from which a pull request gets this label. */
  readonly from: number;
  readonly color: string;
}

/** Smallest first; the bounds follow t3code's labels. */
export const SIZE_LABELS: readonly SizeLabel[] = [
  { name: "size:XS", from: 0, color: "0e8a16" },
  { name: "size:S", from: 10, color: "5ebd3e" },
  { name: "size:M", from: 30, color: "fbca04" },
  { name: "size:L", from: 100, color: "fe7d37" },
  { name: "size:XL", from: 500, color: "d93f0b" },
  { name: "size:XXL", from: 1000, color: "b60205" },
];

/** The label from which a pull request needs a review and an app check. */
export const REVIEW_LABEL = "size:XXL";

/** One file of `git diff --numstat`, under the path it has after the change; a binary file counts no lines. */
export interface ChangedFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
}

/** Files a tool writes: lockfiles and the extracted translation catalogs. */
export function isGenerated(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name === "pnpm-lock.yaml" || name === "bun.lock") return true;
  return /^packages\/i18n\/src\/locales\/[^/]+\.po$/u.test(path);
}

/**
 * Documents: what CodeRabbit leaves out of its review (`path_filters` in .coderabbit.yaml), so a
 * pull request of documents alone never asks for one.
 */
export function isDocument(path: string): boolean {
  return path.startsWith("docs/") || path === "GLOSSARY.md";
}

/** Tests and what only tests use: test folders and `*.test.*` / `*.spec.*` files. */
export function isTest(path: string): boolean {
  return (
    /(?:^|\/)(?:test|tests|__tests__|testing)\//u.test(path) ||
    /\.(?:test|spec)\.[^/]+$/u.test(path)
  );
}

/** The files in `git diff --numstat` output. */
export function parseNumstat(text: string): ChangedFile[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [additions = "", deletions = "", ...path] = line.split("\t");
      return {
        path: newPath(path.join("\t")),
        additions: count(additions),
        deletions: count(deletions),
      };
    });
}

/**
 * The path of a file after the change. Git prints a rename as `old => new` or, where the two
 * share a part, as `a/{old => new}/b`; a file moved out of `docs/` is sized as what it now is.
 */
export function newPath(path: string): string {
  const brace = /^(.*)\{(.*) => (.*)\}(.*)$/u.exec(path);
  if (brace !== null) {
    const [, prefix = "", , to = "", suffix = ""] = brace;
    return `${prefix}${to}${suffix}`.replace(/\/\//gu, "/");
  }
  const arrow = path.indexOf(" => ");
  return arrow === -1 ? path : path.slice(arrow + " => ".length);
}

function count(field: string): number {
  return field === "-" ? 0 : Number.parseInt(field, 10) || 0;
}

/**
 * The lines that size a pull request: the changes outside generated files, documents and tests,
 * or, when only tests changed, the changes to the tests.
 */
export function effectiveLines(files: readonly ChangedFile[]): number {
  const counted = files.filter((file) => !isGenerated(file.path) && !isDocument(file.path));
  const sum = (list: readonly ChangedFile[]) =>
    list.reduce((total, file) => total + file.additions + file.deletions, 0);
  const code = sum(counted.filter((file) => !isTest(file.path)));
  return code > 0 ? code : sum(counted);
}

export function sizeLabel(lines: number): SizeLabel {
  const label = SIZE_LABELS.findLast((candidate) => lines >= candidate.from);
  if (label === undefined) throw new Error(`No size label for ${lines} lines`);
  return label;
}

/** The label's description on GitHub, e.g. "100-499 changed lines, without tests, docs …". */
export function describeLabel(label: SizeLabel): string {
  const next = SIZE_LABELS[SIZE_LABELS.indexOf(label) + 1];
  const range =
    next === undefined
      ? `${label.from.toLocaleString("en")}+`
      : `${label.from.toLocaleString("en")}-${(next.from - 1).toLocaleString("en")}`;
  const review = label.name === REVIEW_LABEL ? " Needs a review and an app check." : "";
  return `${range} changed lines, without tests, docs, lockfiles and catalogs.${review}`;
}

function main(args: readonly string[]): void {
  if (args[0] === "labels" && args.length === 1) {
    for (const label of SIZE_LABELS) {
      console.log([label.name, label.color, describeLabel(label)].join("\t"));
    }
    return;
  }
  const [base, head] = args;
  if (base === undefined || head === undefined || args.length !== 2) {
    console.error("Usage: node scripts/pr-size.ts <base> <head> | labels");
    process.exit(1);
  }
  const numstat = execFileSync(
    "git",
    ["diff", "--numstat", "--ignore-all-space", "--ignore-blank-lines", `${base}...${head}`],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const lines = effectiveLines(parseNumstat(numstat));
  const label = sizeLabel(lines);
  console.log(
    `pr-size: ${lines} changed lines without tests, docs, lockfiles and catalogs: ${label.name}`,
  );
  const output = process.env.GITHUB_OUTPUT;
  if (output !== undefined) appendFileSync(output, `label=${label.name}\n`);
}

if (import.meta.main) main(process.argv.slice(2));
