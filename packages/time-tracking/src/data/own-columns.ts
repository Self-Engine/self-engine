import { inputError } from "@self-engine/storage";
import { addDuration, durationBetween, type Instant, subtractDuration } from "@self-engine/time";
import {
  type Break,
  BREAKS_UNKNOWN,
  ROUNDING_RULE_UNKNOWN,
  type RoundingRule,
  roundingRuleTextSchema,
  breaksTextSchema,
} from "../contracts/index.ts";

/**
 * The entry's own rule and its mark, as an edit or a move keeps them. A stored rule this version
 * cannot read refuses the write at the rule: the entry stays as it is until the app is current.
 */
export function ownRule(stored: {
  readonly rounding_rule: string;
  readonly rule_chosen_by_hand: 0 | 1;
}): { readonly rule: RoundingRule; readonly ruleChosenByHand: boolean } {
  const own = roundingRuleTextSchema.safeDecode(stored.rounding_rule);
  if (!own.success) throw inputError(["ruleByHand"], ROUNDING_RULE_UNKNOWN);
  return { rule: own.data, ruleChosenByHand: stored.rule_chosen_by_hand === 1 };
}

/**
 * The entry's own breaks, as an edit that does not replace them or a move keeps them. A stored
 * list this version cannot read refuses the write at the breaks.
 */
export function ownBreaks(stored: { readonly breaks: string }): Break[] {
  const own = breaksTextSchema.safeDecode(stored.breaks);
  if (!own.success) throw inputError(["breaks"], BREAKS_UNKNOWN);
  return own.data;
}

/** Shifts an Instant by the amount from `from` to `to`, forward or back: the step of a move. */
export function shiftedBy(from: Instant, to: Instant): (instant: Instant) => Instant {
  // Instants of the supported years compare as text in time order.
  return to >= from
    ? (instant) => addDuration(instant, durationBetween(from, to))
    : (instant) => subtractDuration(instant, durationBetween(to, from));
}
