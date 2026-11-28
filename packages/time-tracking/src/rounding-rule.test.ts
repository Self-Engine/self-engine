import { describe, expect, test } from "vite-plus/test";
import {
  DEFAULT_ROUNDING_RULE,
  type RoundingRule,
  roundingRuleTextSchema,
} from "./contracts/index.ts";

describe("the stored form of a Rounding Rule", () => {
  test.each<[string, RoundingRule]>([
    ['{"kind":"exact"}', { kind: "exact" }],
    [
      '{"kind":"ordinary","direction":"up","minutes":15}',
      { kind: "ordinary", direction: "up", minutes: 15 },
    ],
    [
      '{"kind":"ordinary","direction":"nearest","minutes":6}',
      { kind: "ordinary", direction: "nearest", minutes: 6 },
    ],
    ['{"kind":"block","minutes":30}', { kind: "block", minutes: 30 }],
  ])("%s reads as its rule and is written back the same", (text, rule) => {
    expect(roundingRuleTextSchema.decode(text)).toEqual(rule);
    expect(roundingRuleTextSchema.encode(rule)).toBe(text);
  });

  test("writes a rule in the same order of keys however it was built", () => {
    const rule = { minutes: 15, direction: "up", kind: "ordinary" } as const;
    expect(roundingRuleTextSchema.encode(rule)).toBe(
      '{"kind":"ordinary","direction":"up","minutes":15}',
    );
  });

  test.each([
    ["text that is no JSON", "round up"],
    ["an unknown kind", '{"kind":"minimum","minutes":15}'],
    ["a step outside the list", '{"kind":"ordinary","direction":"up","minutes":7}'],
    ["a Block length outside the list", '{"kind":"block","minutes":6}'],
    ["an unknown direction", '{"kind":"ordinary","direction":"sideways","minutes":15}'],
    ["a field the kind does not have", '{"kind":"exact","minutes":15}'],
    ["JSON that is no object", "15"],
  ])("%s is told apart from a rule", (_, text) => {
    expect(roundingRuleTextSchema.safeDecode(text).success).toBe(false);
  });

  test("the default rule is round up to 1 minute", () => {
    expect(roundingRuleTextSchema.encode(DEFAULT_ROUNDING_RULE)).toBe(
      '{"kind":"ordinary","direction":"up","minutes":1}',
    );
  });
});
