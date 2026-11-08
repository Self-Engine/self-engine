// The theme stage of `pnpm verify`: CSS in apps and packages uses Color Roles only. It reports
// color literals, `--se-*` names the theme package does not define, and any use of Mantine's
// palette variables (`--mantine-color-*`). `transparent`, `currentColor` and `inherit` stay
// allowed, as do the theme package itself and the prototypes, which live outside the workspace.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import * as theme from "@self-engine/theme";
import { WORKSPACE_FOLDERS } from "./workspace-manifest.ts";

const COLOR_LITERAL =
  /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])|(?<![\w-])(?:rgba?|hsla?|oklch)\(/gi;

const VARIABLE = /(?<![\w-])--(?:se-[\w-]+|mantine-color-[\w-]+)/g;
const THEME_VARIABLE = /(?<![\w-])--se-[\w-]+/g;

const CSS_STRING = String.raw`"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'`;
const OPAQUE_TEXT = new RegExp(
  String.raw`/\*[\s\S]*?(?:\*/|$)|${CSS_STRING}|(?<![\w-])url\(\s*(?:${CSS_STRING}|[^)"']*)\s*\)`,
  "gi",
);

/** A run of CSS up to the character that ends it: `{`, `}`, `;` or the end of the file. */
const STATEMENT = /([^{};]*)([{};]|$)/g;

/** The theme package is the one place allowed to hold raw colors. */
const THEME_PACKAGE = "packages/theme/";

/** Generated or installed output; hidden folders are skipped as well. */
const SKIPPED_FOLDERS = new Set([
  "node_modules",
  "dist",
  "dist-electron",
  "dist-release",
  "release",
]);

function cssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const skipped = SKIPPED_FOLDERS.has(entry.name) || entry.name.startsWith(".");
      return skipped ? [] : cssFiles(path);
    }
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

interface Finding {
  readonly index: number;
  readonly message: string;
}

/** `source` with its comments, strings and urls blanked out, so offsets and lines stay right. */
function maskOpaqueText(source: string): string {
  return source.replaceAll(OPAQUE_TEXT, (text) => text.replaceAll(/[^\n]/g, " "));
}

/**
 * Only in declarations: a statement that opens a block is a selector, where `#add` is an id,
 * or an at-rule, where `@supports (color: oklch(0 0 0))` asks for a feature and sets no color.
 */
function findColorLiterals(css: string): Finding[] {
  return [...css.matchAll(STATEMENT)]
    .filter(([, , end]) => end !== "{")
    .flatMap((statement) =>
      [...(statement[1] ?? "").matchAll(COLOR_LITERAL)].map((literal) => ({
        index: statement.index + literal.index,
        message: `color literal "${literal[0]}": use a Color Role`,
      })),
    );
}

function findVariables(source: string, known: ReadonlySet<string>): Finding[] {
  return [...source.matchAll(VARIABLE)].flatMap((match): Finding[] => {
    const name = match[0];
    if (name.startsWith("--mantine-color-")) {
      return [
        { index: match.index, message: `Mantine palette variable "${name}": use a Color Role` },
      ];
    }
    return known.has(name)
      ? []
      : [
          {
            index: match.index,
            message: `unknown theme variable "${name}": not defined by @self-engine/theme`,
          },
        ];
  });
}

function findFileProblems(name: string, source: string, known: ReadonlySet<string>): string[] {
  const css = maskOpaqueText(source);
  return [...findColorLiterals(css), ...findVariables(css, known)]
    .sort((a, b) => a.index - b.index)
    .map((finding) => `${name}:${lineOf(source, finding.index)}: ${finding.message}`);
}

/** Every `--se-*` name found in `exports`, in object keys and strings at any depth. */
export function collectThemeVariables(exports: unknown): Set<string> {
  const names = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      for (const [name] of value.matchAll(THEME_VARIABLE)) names.add(name);
      return;
    }
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    seen.add(value);
    for (const [key, entry] of Object.entries(value)) {
      visit(key);
      visit(entry);
    }
  };
  visit(exports);
  return names;
}

/**
 * The names the theme package defines: whatever its public exports hold as data, plus what the
 * engine outputs for the default appearance. A name only a function can produce is invisible
 * here, so a new `--se-*` variable needs to appear in an exported value or in that output.
 */
export function themeVariables(): Set<string> {
  return collectThemeVariables([
    theme,
    theme.resolveAppearance(theme.DEFAULT_APPEARANCE, theme.BUILT_IN_THEMES),
  ]);
}

/** The violations in the CSS of `root`, as `<path>:<line>: <what>`. */
export function findThemeCssProblems(root: string, known: ReadonlySet<string>): string[] {
  return WORKSPACE_FOLDERS.flatMap((folder) => cssFiles(join(root, folder))).flatMap((file) => {
    const name = relative(root, file).split(sep).join("/");
    if (name.startsWith(THEME_PACKAGE)) return [];
    return findFileProblems(name, readFileSync(file, "utf8"), known);
  });
}

function main(): void {
  const root = process.argv[2] ?? resolve(import.meta.dirname, "..");
  const problems = findThemeCssProblems(root, themeVariables());
  if (problems.length > 0) {
    console.error(`check-theme-css:\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log("check-theme-css: ok");
}

if (import.meta.main) main();
