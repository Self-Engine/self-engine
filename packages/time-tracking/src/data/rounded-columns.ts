import { type Instant, wholeSecondOf } from "@self-engine/time";
import {
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
