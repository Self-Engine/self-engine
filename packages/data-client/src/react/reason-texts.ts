import type { I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
// Types only: the texts load at startup with the hook, where the Reasons' schemas must not
// (startup check). The details are typed from the schemas all the same.
import type { FrameReasons, Reason, ReasonDefinition, ReasonOf } from "@self-engine/data-protocol";
import { type CountedName, formatCountedList } from "@self-engine/i18n";

/** What the text of a Reason is given besides the Reason. */
export interface ReasonTextContext {
  /** The App Language of the moment; a text is built anew when it changes. */
  readonly i18n: I18n;
  /** The plural name of a synced table by its SQL name; a table no module names reads "entries". */
  readonly tableName: (table: string) => CountedName;
}

/**
 * The text of one Reason (D334), written by the package that owns the Reason, in its UI part: a
 * sentence in the App Language, built from the Reason with its details typed by its definition.
 * Import the definition as a type only, so its schema stays out of the start.
 */
export type ReasonText<Definition extends ReasonDefinition> = (
  reason: ReasonOf<Definition>,
  context: ReasonTextContext,
) => string;

/** The texts of these Reasons by their codes: exactly one text for each. */
export type ReasonTexts<Definitions extends ReasonDefinition> = {
  readonly [Definition in Definitions as Definition["code"]]: ReasonText<Definition>;
};

/** The text of a Reason as the app holds it, by its code: it takes the Reason of that code. */
export type AnyReasonText = (reason: never, context: ReasonTextContext) => string;

/** Every Reason's text the app shows, composed where the app is put together. */
export interface RefusalTexts {
  /** The Reason as a sentence in the language of `i18n`. */
  readonly describe: (reason: Reason, i18n: I18n) => string;
}

/** Shown for a Reason whose code has no text, which a compiled app never meets. */
export const UNDESCRIBED_REASON = msg`This change is not allowed.`;

/** The name of a table no module names. */
const UNNAMED_TABLE: CountedName = (count) =>
  msg`${plural(count, { one: "entry", other: "entries" })}`;

/**
 * The texts of the app's Reasons, for the `DataProvider`: the frame's own (`frameReasonTexts`)
 * and those of `sources`, each module's `reasonTexts` of its data texts (`dataTexts`) and the
 * texts of the rules registered from above. `tableName` is the module list's lookup of table
 * names. Two texts for one code are a composition error and throw.
 */
export function refusalTexts(
  sources: readonly Readonly<Record<string, AnyReasonText>>[],
  tableName: (table: string) => CountedName | undefined,
): RefusalTexts {
  const byCode = new Map<string, AnyReasonText>();
  for (const texts of [frameReasonTexts as Readonly<Record<string, AnyReasonText>>, ...sources]) {
    for (const [code, text] of Object.entries(texts)) {
      if (byCode.has(code)) throw new Error(`Two texts for the Reason ${code}`);
      byCode.set(code, text);
    }
  }
  const named = (table: string) => tableName(table) ?? UNNAMED_TABLE;
  return {
    describe(reason, i18n) {
      const text = byCode.get(reason.code);
      if (text === undefined) return i18n._(UNDESCRIBED_REASON);
      // The Data Process checked the details against the definition of this code when the rule
      // answered, and page and Data Process are one build: the text takes them as typed.
      return (text as ReasonText<ReasonDefinition>)(reason as ReasonOf<ReasonDefinition>, {
        i18n,
        tableName: named,
      });
    },
  };
}

/** The two Reasons of the frame's reference check (D337), listed beside their definitions. */
export type { FrameReasons };

/**
 * The texts of the frame's Reasons. Their definitions belong to the storage frame, which has no
 * UI part; the page's side of the frame is this building block, so their texts are written here.
 */
export const frameReasonTexts: ReasonTexts<FrameReasons> = {
  // One sentence from the names and counts (D335), formulaic by intent: "Cannot be deleted: 12
  // time entries and 3 tasks refer to it." The verb agrees with the total.
  referenced: ({ details }, { i18n, tableName }) => {
    const { tables } = details;
    const list = formatCountedList(
      i18n,
      tables.map(({ table, count }) => ({ name: tableName(table), count })),
    );
    const total = tables.reduce((sum, { count }) => sum + count, 0);
    return i18n._(
      msg`${plural(total, {
        one: `Cannot be deleted: ${list} refers to it.`,
        other: `Cannot be deleted: ${list} refer to it.`,
      })}`,
    );
  },
  target_deleted: ({ details }, { i18n, tableName }) => {
    const name = i18n._(tableName(details.target.table)(1));
    return i18n._(msg`The linked ${name} was deleted.`);
  },
};
