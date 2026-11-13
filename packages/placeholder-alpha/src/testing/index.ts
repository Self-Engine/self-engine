// For stories and tests only (D255): Fixed Answers for `placeholder-alpha` and sample rows. The
// boundary rule keeps this entry, and the Contract schemas it loads, out of the app.

import {
  type FixedAnswerOptions,
  type FixedAnswers,
  fixedAnswers,
} from "@self-engine/data-client/testing";
import type { PortAccess } from "@self-engine/data-client/react";
import { placeholderAlphaContract } from "../contracts/index.ts";

const contracts = { placeholderAlpha: placeholderAlphaContract };

/** What each entry of `placeholder-alpha` answers in a story. */
export type PlaceholderAlphaAnswers = NonNullable<
  FixedAnswers<typeof contracts>["placeholderAlpha"]
>;

/** A well-formed entry id, numbered: what the Data Process would hand out. */
export function sampleEntryId(index: number): string {
  return `01a1cfa1-0a00-7000-8000-${index.toString(16).padStart(12, "0")}`;
}

export const STUDIO_WORK = { id: sampleEntryId(1), name: "Studio work" };
export const GARDEN_WORK = { id: sampleEntryId(2), name: "Garden work" };

/** `count` entries named "Entry 1" to "Entry <count>", for a long list. */
export function sampleEntries(count: number): { id: string; name: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: sampleEntryId(index + 1),
    name: `Entry ${index + 1}`,
  }));
}

/**
 * The answers of a story where every Operation succeeds and the list holds Studio work and Garden
 * work. An Operation changes nothing: no Table Change follows, so the list stays as it is.
 */
export const SUCCEEDING: PlaceholderAlphaAnswers = {
  list: { data: [STUDIO_WORK, GARDEN_WORK] },
  create: { data: { id: sampleEntryId(3), name: "Sample entry" } },
  rename: { data: STUDIO_WORK },
  delete: { data: STUDIO_WORK },
  restore: { data: STUDIO_WORK },
};

/** The Port access of a story: `answers` over the succeeding ones, checked against the Contract. */
export function placeholderAlphaAnswers(
  answers: PlaceholderAlphaAnswers = {},
  options?: FixedAnswerOptions,
): PortAccess {
  return fixedAnswers(contracts, { placeholderAlpha: { ...SUCCEEDING, ...answers } }, options);
}
