import { z } from "zod";

/** The steps of Ordinary Rounding, in minutes: a fixed list keeps them aligned to the hour. */
export const ORDINARY_ROUNDING_MINUTES = [1, 5, 6, 10, 15, 30, 60] as const;

/** The lengths of a Block under Block Rounding, in minutes; each divides the clock's hour. */
export const BLOCK_ROUNDING_MINUTES = [5, 10, 15, 30, 60] as const;

/** Where Ordinary Rounding takes the counting time: up, down, or to the nearest step. */
export const ROUNDING_DIRECTIONS = ["up", "down", "nearest"] as const;

const minutesOf = <const T extends readonly number[]>(values: T) =>
  z.union(values.map((value) => z.literal(value)) as unknown as [z.ZodLiteral<T[number]>]);

const exactSchema = z.strictObject({ kind: z.literal("exact") });

const ordinarySchema = z.strictObject({
  kind: z.literal("ordinary"),
  direction: z.enum(ROUNDING_DIRECTIONS),
  minutes: minutesOf(ORDINARY_ROUNDING_MINUTES),
});

const blockSchema = z.strictObject({
  kind: z.literal("block"),
  minutes: minutesOf(BLOCK_ROUNDING_MINUTES),
});

/**
 * A Rounding Rule as a value: Exact, Ordinary Rounding or Block Rounding, told apart by `kind`. A
 * later kind is one more member, and the compiler names every place that has to handle it.
 */
export const roundingRuleSchema = z.discriminatedUnion("kind", [
  exactSchema,
  ordinarySchema,
  blockSchema,
]);
export type RoundingRule = z.output<typeof roundingRuleSchema>;

/** The seconds the shares of an entry are cut down to: a minute, or a second under Exact. */
export type ShareUnit = 1 | 60;

/**
 * The unit the Project Shares and the Day Shares of an entry under `rule` are cut down to: a
 * second under Exact, otherwise a minute. Without a rule this version can read, the shares count
 * whole seconds.
 */
export function shareUnitOf(rule: RoundingRule | null): ShareUnit {
  return rule === null || rule.kind === "exact" ? 1 : 60;
}

/** The rule that holds where no other one does: round up to 1 minute. */
export const DEFAULT_ROUNDING_RULE: RoundingRule = {
  kind: "ordinary",
  direction: "up",
  minutes: 1,
};

/**
 * The stored form of a Rounding Rule, the same in every table that holds one: JSON text such as
 * `{"kind":"ordinary","direction":"up","minutes":15}`. `decode` reads it and `encode` writes it,
 * with the keys in a fixed order. Text that is no JSON, or no rule this version knows, fails to
 * decode, so a reader tells it apart from a rule (`safeDecode`).
 */
export const roundingRuleTextSchema = z.codec(z.string(), roundingRuleSchema, {
  decode: (text, context) => {
    try {
      // Read as a rule on trust; the rule's schema checks it right after.
      return JSON.parse(text) as z.input<typeof roundingRuleSchema>;
    } catch {
      // Text that is no JSON is reported as an issue of the decode, not thrown.
      context.issues.push({ code: "invalid_format", format: "json", input: text });
      return z.NEVER;
    }
  },
  encode: (rule) => JSON.stringify(rule),
});
