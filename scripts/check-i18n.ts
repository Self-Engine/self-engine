// The i18n stage of `pnpm verify` (ADR 0011). The catalogs have to match the source: a local run
// extracts and writes them first, like the format stage, so new text shows up as named missing
// translations; `--check` (the stage under CI) only compares and writes nothing. Then every
// translation is held against its message: German and English are complete, placeholders and
// numbered rich-text tags are the same, and every text is valid ICU. A gap in a further language
// only warns.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { type CatalogFormatter, getConfig, type LinguiConfigNormalized } from "@lingui/conf";
import { parse, type Token } from "@messageformat/parser";
import { LANGUAGE_TAGS, LANGUAGES } from "@self-engine/i18n";
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

/** The sorted placeholders and rich-text tags of an ICU text, or the parse error as a string. */
function placeholdersOf(text: string): string[] | string {
  let tokens: Token[];
  try {
    tokens = parse(text);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
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
  return [...found].sort();
}

function listed(placeholders: readonly string[]): string {
  return placeholders.length > 0 ? placeholders.join(", ") : "(none)";
}

/** Holds every translation against its message. */
export function checkCatalogs({ catalogs, required }: CatalogCheckInput): CatalogCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [language, entries] of Object.entries(catalogs)) {
    for (const { message, context, translation } of entries) {
      const label = `${language}: "${message}"${context ? ` (${context})` : ""}`;
      if (!translation) {
        (required.includes(language) ? errors : warnings).push(`${label} is not translated`);
        continue;
      }
      const expected = placeholdersOf(message);
      const actual = placeholdersOf(translation);
      const invalid = [expected, actual].find((result) => typeof result === "string");
      if (typeof expected === "string" || typeof actual === "string") {
        errors.push(`${label} is not valid ICU: ${String(invalid)}`);
        continue;
      }
      if (expected.join() !== actual.join()) {
        errors.push(
          `${label} has placeholders ${listed(actual)}, the message has ${listed(expected)}`,
        );
      }
    }
  }
  return { errors, warnings };
}

/** The languages whose catalogs have to be complete. */
export function requiredLanguages(): string[] {
  return LANGUAGE_TAGS.filter((language) => LANGUAGES[language].required);
}

async function readCatalog(
  config: LinguiConfigNormalized,
  locale: string,
): Promise<CatalogEntry[]> {
  const format = config.format as CatalogFormatter;
  const sourceLocale = config.sourceLocale ?? null;
  const entries = await Promise.all(
    config.catalogs.map(async (catalog) => {
      const filename = `${catalog.path.replace("{locale}", locale)}${format.catalogExtension}`;
      // Only with --check: the sync step has already reported the file as missing.
      if (!existsSync(filename)) return [];
      const content = readFileSync(filename, "utf8");
      const parsed = await format.parse(content, { locale, sourceLocale, filename });
      // An entry without a message has no source text of its own, so its key stands in for it.
      return Object.entries(parsed).map(([key, { message, context, translation = "" }]) => ({
        message: message ?? key,
        context,
        translation,
      }));
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
      config.locales.map(async (locale) => [locale, await readCatalog(config, locale)] as const),
    ),
  );
  const { errors, warnings } = checkCatalogs({ catalogs, required: requiredLanguages() });
  for (const warning of warnings) console.warn(`warning ${warning}`);
  if (errors.length > 0) console.error(`check-i18n:\n${errors.join("\n")}`);
  if (sync.code !== 0 || errors.length > 0) process.exit(1);
  console.log(`check-i18n: ok (${config.locales.join(", ")}; ${warnings.length} warnings)`);
}

if (import.meta.main) await main();
