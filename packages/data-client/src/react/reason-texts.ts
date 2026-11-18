import type { I18n } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
// Types only: the texts load at startup with the hook, where the Reasons' schemas must not
// (startup check). The details are typed from the schemas all the same.
import type {
  Reason,
  ReasonDefinition,
  ReasonOf,
  referenced,
  targetDeleted,
} from "@self-engine/data-protocol";
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

/** Asks for the list of Reasons by name instead of taking whatever texts were given. */
type Named<Definitions extends ReasonDefinition> = [Definitions] extends [never]
  ? { readonly "name every Reason definition as the type argument": never }
  : ReasonTexts<Definitions>;

/**
 * The texts of the app's Reasons, for the `DataProvider`. The type argument is the list of every
 * Reason definition the app's Protection Rules answer with: a definition without its text does
 * not compile. `tableName` is the module list's lookup of table names.
 */
export function refusalTexts<Definitions extends ReasonDefinition = never>(
  texts: Named<NoInfer<Definitions>>,
  tableName: (table: string) => CountedName | undefined,
): RefusalTexts {
  // The runtime view: a text takes the Reason of its code.
  const byCode = texts as Readonly<Record<string, ReasonText<ReasonDefinition>>>;
  const named = (table: string) => tableName(table) ?? UNNAMED_TABLE;
  return {
    describe(reason, i18n) {
      if (!Object.hasOwn(byCode, reason.code)) return i18n._(UNDESCRIBED_REASON);
      // The Data Process checked the details against the definition of this code when the rule
      // answered, and page and Data Process are one build: the text takes them as typed.
      return byCode[reason.code]!(reason as ReasonOf<ReasonDefinition>, { i18n, tableName: named });
    },
  };
}

/** The two Reasons of the frame's reference check (D337). */
export type FrameReasons = typeof referenced | typeof targetDeleted;

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
