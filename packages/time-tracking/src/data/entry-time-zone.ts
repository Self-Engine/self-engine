import { resolveTimeZone, type TimeZone } from "@self-engine/time";
import { type RoundingRule, TIME_ZONE_UNKNOWN, type TimeEntryFinding } from "../contracts/index.ts";

const UTC = resolveTimeZone("UTC").timeZone;

/**
 * The Time Zone an entry computes with: the name it stores, or UTC when this runtime does not know
 * the name, since its Blocks need a clock and no device's zone is the entry's. `known` says which.
 */
export function entryTimeZone(name: string): { readonly timeZone: TimeZone; readonly known: boolean } {
  // A stored name always has the shape of a zone name: it was resolved when it was written.
  const resolved = resolveTimeZone(name);
  return resolved.deviceFallback
    ? { timeZone: UTC, known: false }
    : { timeZone: resolved.timeZone, known: true };
}

/**
 * The rules an entry breaks, found on read and never stored: under Block Rounding a Time Zone this
 * runtime does not know, whose Blocks were counted in UTC. Only an answer of one entry asks, so a
 * list resolves no zone.
 */
export function findingsOf(rule: RoundingRule | null, timeZoneName: string): TimeEntryFinding[] {
  if (rule?.kind !== "block" || entryTimeZone(timeZoneName).known) return [];
  return [{ reason: TIME_ZONE_UNKNOWN }];
}
