import type { TablesOf } from "@self-engine/db";
import type { ProjectId } from "@self-engine/projects/ids";
import { type ReadTransaction, sharedEntry, type StorageContext } from "@self-engine/storage";
import { type Instant, wholeSecondOf } from "@self-engine/time";
import {
  computeTimeEntry,
  DEFAULT_ROUNDING_RULE,
  type RoundingRule,
  roundingRuleTextSchema,
} from "../contracts/index.ts";
import { entryTimeZone } from "./entry-time-zone.ts";
import type { timeTrackingRowMap } from "./rows.ts";

type Tables = TablesOf<typeof timeTrackingRowMap>;

/** What a write of a Time Entry computes with: never a Rounded Time or a Booked Duration. */
export interface EntryComputation {
  readonly startedAt: Instant;
  readonly endedAt: Instant;
  /** The entry's rule: chosen by hand, its own one on an edit, or the rule that holds. */
  readonly rule: RoundingRule;
  /** The mark "rule chosen by hand". */
  readonly ruleChosenByHand: boolean;
  /** The name of the entry's Time Zone, as its row stores it. */
  readonly timeZone: string;
}

/** The entry a rule is looked up for: its project, or none, and its measured start. */
export interface RuleLookup {
  readonly projectId: ProjectId | null;
  readonly startedAt: Instant;
}

/**
 * The rows of Rounding Rules that may hold for an entry, the one that holds first (ADR 0044):
 * the project's rules before the app-wide ones, each by the latest "holds from" at or before the
 * measured start, where a rule without one holds from the beginning; of two with the same "holds
 * from" the one changed last, then the one with the larger id. A project's rule whose project is
 * deleted is no Live Row (ADR 0042).
 */
export function ruleRows(
  tx: ReadTransaction<Tables>,
  context: StorageContext,
  { projectId, startedAt }: RuleLookup,
) {
  const start = wholeSecondOf(startedAt);
  return (
    sharedEntry(tx, context)
      .live("rounding_rules")
      .select("rounding_rules.rounding_rule")
      .where((eb) =>
        eb.or([
          eb("rounding_rules.project_id", "is", null),
          ...(projectId === null ? [] : [eb("rounding_rules.project_id", "=", projectId)]),
        ]),
      )
      // Instants of the supported years compare as text in time order.
      .where((eb) =>
        eb.or([
          eb("rounding_rules.holds_from", "is", null),
          eb("rounding_rules.holds_from", "<=", start),
        ]),
      )
      .orderBy((eb) => eb("rounding_rules.project_id", "is", null))
      .orderBy((eb) => eb("rounding_rules.holds_from", "is", null))
      .orderBy("rounding_rules.holds_from", "desc")
      .orderBy("rounding_rules.updated_at", "desc")
      .orderBy("rounding_rules.id", "desc")
      .limit(1)
  );
}

/**
 * The rule that holds for an entry without a rule chosen by hand, in one read: the rule of its
 * project that held at its measured start, else the app-wide rule that held, else the default
 * built into the code, "round up to 1 minute". A stored rule this version cannot read is skipped
 * for the default, as a rule that does not exist here.
 */
export async function ruleThatHolds(
  tx: ReadTransaction<Tables>,
  context: StorageContext,
  entry: RuleLookup,
): Promise<RoundingRule> {
  const row = await ruleRows(tx, context, entry).executeTakeFirst();
  if (row === undefined) return DEFAULT_ROUNDING_RULE;
  const rule = roundingRuleTextSchema.safeDecode(row.rounding_rule);
  return rule.success ? rule.data : DEFAULT_ROUNDING_RULE;
}

/**
 * The columns of the Measured Time, the Rounded Time, the Booked Duration and the rule, the one
 * place that computes them (ADR 0044): both measured Instants cut to the whole second, then
 * `computeTimeEntry` with the entry's rule in the entry's Time Zone. Every write of a Time Entry
 * takes all of them from here.
 */
export function roundedColumns(entry: EntryComputation) {
  const started_at = wholeSecondOf(entry.startedAt);
  const ended_at = wholeSecondOf(entry.endedAt);
  const { rule } = entry;
  const { roundedTime, bookedDuration } = computeTimeEntry({
    measuredTime: { start: started_at, end: ended_at },
    timeZone: entryTimeZone(entry.timeZone).timeZone,
    rule,
  });
  return {
    started_at,
    ended_at,
    rounded_started_at: roundedTime?.start ?? null,
    rounded_ended_at: roundedTime?.end ?? null,
    booked_duration: bookedDuration,
    rounding_rule: roundingRuleTextSchema.encode(rule),
    rule_chosen_by_hand: entry.ruleChosenByHand ? (1 as const) : (0 as const),
  };
}
