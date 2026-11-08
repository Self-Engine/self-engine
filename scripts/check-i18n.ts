// The i18n stage of `pnpm verify` (ADR 0011). The catalogs have to match the source: a local run
// extracts and writes them first, like the format stage, so new text shows up as named missing
// translations; `--check` (the stage under CI) only compares and writes nothing. Then every
// translation is held against its message: German and English are complete, placeholders and
// numbered rich-text tags are the same, and every text is valid ICU. A gap in a further language
// only warns. Under `--check`, a stale catalog also names its messages, since nothing is extracted.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { getCatalogs } from "@lingui/cli/api";
import { type CatalogFormatter, getConfig, type LinguiConfigNormalized } from "@lingui/conf";
import { parse, type Token } from "@messageformat/parser";
import { requiredLanguages } from "@self-engine/i18n";
import { capture } from "./verify.ts";

export interface CatalogEntry {
  readonly message: string;
  readonly context?: string | undefined;
  /** Empty while the message is untranslated. */
  readonly translation: string;
}

export interface CatalogCheckInput {
  /** The entries of every language's catalog, by language tag. */
  readonly catalogs: Readonly<Record<string, readonly CatalogEntry[]>>;
  /** The languages that have to be complete; a gap in any other only warns. */
  readonly required: readonly string[];
}

export interface CatalogCheckResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** An opening, closing or self-closing numbered tag: Lingui's form of rich text. */
const RICH_TEXT_TAG = /<\/?\d+\/?>/g;

type ParsedText =
  | { readonly ok: true; readonly placeholders: readonly string[] }
  | { readonly ok: false; readonly error: string };

/** The sorted placeholders and rich-text tags of an ICU text. */
function placeholdersOf(text: string): ParsedText {
  let tokens: Token[];
  try {
    tokens = parse(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const found = new Set<string>();
  const visit = (list: readonly Token[]): void => {
    for (const token of list) {
      if (token.type === "content") {
        for (const [tag] of token.value.matchAll(RICH_TEXT_TAG)) found.add(tag);
      } else if (token.type === "argument" || token.type === "function") {
        found.add(`{${token.arg}}`);
      } else if (token.type !== "octothorpe") {
        found.add(`{${token.arg}}`);
        for (const { tokens: caseTokens } of token.cases) visit(caseTokens);
      }
    }
  };
  visit(tokens);
  return { ok: true, placeholders: [...found].sort() };
}

function listed(placeholders: readonly string[]): string {
  return placeholders.length > 0 ? placeholders.join(", ") : "(none)";
}

/** What is wrong with a translation that is not empty, as the end of a sentence. */
function translationProblem(message: string, translation: string): string | undefined {
  const expected = placeholdersOf(message);
  if (!expected.ok) return `is not valid ICU: ${expected.error}`;
  const actual = placeholdersOf(translation);
  if (!actual.ok) return `is not valid ICU: ${actual.error}`;
  if (expected.placeholders.join() === actual.placeholders.join()) return undefined;
  return `has placeholders ${listed(actual.placeholders)}, the message has ${listed(expected.placeholders)}`;
}

function labelOf(language: string, { message, context }: CatalogEntry): string {
  return `${language}: "${message}"${context ? ` (${context})` : ""}`;
}

/** Holds every translation against its message. */
export function checkCatalogs({ catalogs, required }: CatalogCheckInput): CatalogCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [language, entries] of Object.entries(catalogs)) {
    for (const entry of entries) {
      const label = labelOf(language, entry);
      if (!entry.translation) {
        (required.includes(language) ? errors : warnings).push(`${label} is not translated`);
        continue;
      }
      const problem = translationProblem(entry.message, entry.translation);
      if (problem !== undefined) errors.push(`${label} ${problem}`);
    }
  }
  return { errors, warnings };
}

function toEntry({
  message = "",
  context,
  translation = "",
}: {
  readonly message?: string | undefined;
  readonly context?: string | undefined;
  readonly translation?: string | undefined;
}): CatalogEntry {
  return { message, context, translation };
}

/** Names what extraction would add to or remove from each catalog. */
function staleMessages(
  source: readonly CatalogEntry[],
  catalogs: CatalogCheckInput["catalogs"],
): string[] {
  const identity = ({ message, context }: CatalogEntry): string =>
    JSON.stringify([message, context ?? null]);
  const inSource = new Set(source.map(identity));
  return Object.entries(catalogs).flatMap(([language, entries]) => {
    const inCatalog = new Set(entries.map(identity));
    return [
      ...source
        .filter((entry) => !inCatalog.has(identity(entry)))
        .map((entry) => `${labelOf(language, entry)} is missing from the catalog`),
      ...entries
        .filter((entry) => !inSource.has(identity(entry)))
        .map((entry) => `${labelOf(language, entry)} is no longer in the source`),
    ];
  });
}

/** The stale messages of the catalogs, without writing them. */
async function findStaleMessages(
  config: LinguiConfigNormalized,
  catalogs: CatalogCheckInput["catalogs"],
): Promise<string[]> {
  const extracted = await Promise.all(
    (await getCatalogs(config)).map((catalog) => catalog.collect()),
  );
  // A source file that cannot be extracted says nothing about the messages it would hold.
  if (extracted.includes(undefined)) return [];
  const source = extracted.flatMap((messages) => Object.values(messages ?? {}).map(toEntry));
  return staleMessages(source, catalogs);
}

async function readCatalog(
  config: LinguiConfigNormalized,
  language: string,
): Promise<CatalogEntry[]> {
  const format = config.format as CatalogFormatter;
  const entries = await Promise.all(
    config.catalogs.map(async (catalog) => {
      const filename = `${catalog.path.replace("{locale}", language)}${format.catalogExtension}`;
      // Only with --check: the sync step has already reported the file as missing.
      if (!existsSync(filename)) return [];
      const parsed = await format.parse(readFileSync(filename, "utf8"), {
        locale: language,
        sourceLocale: config.sourceLocale ?? null,
        filename,
      });
      return Object.values(parsed).map(toEntry);
    }),
  );
  return entries.flat();
}

async function main(): Promise<void> {
  const repo = resolve(import.meta.dirname, "..");
  const { values } = parseArgs({
    options: { check: { type: "boolean", default: false }, config: { type: "string" } },
  });
  const configPath = values.config ?? resolve(repo, "packages/i18n/lingui.config.ts");
  const lingui = resolve(repo, "packages/i18n/node_modules/.bin/lingui");
  const sync = await capture(
    lingui,
    values.check
      ? ["check", "sync", "--clean", "--config", configPath]
      : ["extract", "--clean", "--config", configPath],
    process.cwd(),
  );
  if (sync.code !== 0) {
    console.error(sync.output.trimEnd());
    if (values.check)
      console.error("check-i18n: run `pnpm verify` locally and commit the catalogs");
  }

  const config = getConfig({ configPath });
  const catalogs = Object.fromEntries(
    await Promise.all(
      config.locales.map(
        async (language) => [language, await readCatalog(config, language)] as const,
      ),
    ),
  );
  const { errors, warnings } = checkCatalogs({ catalogs, required: requiredLanguages() });
  const stale = values.check && sync.code !== 0 ? await findStaleMessages(config, catalogs) : [];
  const problems = [...stale, ...errors];
  for (const warning of warnings) console.warn(`warning ${warning}`);
  if (problems.length > 0) console.error(`check-i18n:\n${problems.join("\n")}`);
  if (sync.code !== 0 || problems.length > 0) process.exit(1);
  console.log(`check-i18n: ok (${config.locales.join(", ")}; ${warnings.length} warnings)`);
}

if (import.meta.main) await main();
