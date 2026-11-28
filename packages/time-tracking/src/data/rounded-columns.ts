import { inputError } from "@self-engine/storage";
import { type Instant, wholeSecondOf } from "@self-engine/time";
import {
  type Break,
  breaksTextSchema,
  onWholeSeconds,
  computeTimeEntry,
  DEFAULT_ROUNDING_RULE,
  type RoundingRule,
  roundingRuleTextSchema,
} from "../contracts/index.ts";
import { entryTimeZone } from "./entry-time-zone.ts";

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
  /** The breaks inside the entry: the list it keeps, or the one it gets. */
  readonly breaks: readonly Break[];
}

/**
 * The rule that holds for an entry: until the table of Rounding Rules exists, the default built
 * into the code, "round up to 1 minute".
 */
export function ruleThatHolds(): RoundingRule {
  return DEFAULT_ROUNDING_RULE;
}

/**
 * The columns of the Measured Time, the Rounded Time, the Booked Duration and the rule, the one
 * place that computes them (ADR 0044): both measured Instants cut to the whole second, then
 * `computeTimeEntry` with the entry's rule in the entry's Time Zone. Every write of a Time Entry
 * takes all of them from here. The breaks are stored on whole seconds too, and a break that breaks
 * a rule refuses the write with its Reason at that break (ADR 0040): nothing changes a break on
 * its own.
 */
export function roundedColumns(entry: EntryComputation) {
  const started_at = wholeSecondOf(entry.startedAt);
  const ended_at = wholeSecondOf(entry.endedAt);
  const { rule } = entry;
  const breaks = entry.breaks.map(onWholeSeconds);
  const { roundedTime, bookedDuration, findings } = computeTimeEntry({
    measuredTime: { start: started_at, end: ended_at },
    timeZone: entryTimeZone(entry.timeZone).timeZone,
    rule,
    breaks,
  });
  const [first] = findings;
  if (first !== undefined) throw inputError(["breaks", first.breakIndex], first.reason);
  return {
    started_at,
    ended_at,
    rounded_started_at: roundedTime?.start ?? null,
    rounded_ended_at: roundedTime?.end ?? null,
    booked_duration: bookedDuration,
    rounding_rule: roundingRuleTextSchema.encode(rule),
    rule_chosen_by_hand: entry.ruleChosenByHand ? (1 as const) : (0 as const),
    breaks: breaksTextSchema.encode(breaks),
  };
}
