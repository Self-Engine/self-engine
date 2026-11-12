import { instantSchema, type Instant } from "@self-engine/time";
import { v7 } from "uuid";

/** Where the current time comes from. A test supplies its own. */
export type Clock = () => Date;

/** What a test supplies to get a known id. `random` returns 16 bytes. */
export interface IdSources {
  readonly clock: Clock;
  readonly random: () => Uint8Array;
}

/** A new time-ordered UUIDv7, the id of every record. */
export function newId(sources?: IdSources): string {
  // Without sources, uuid keeps a counter that orders ids made within one millisecond.
  return sources === undefined
    ? v7()
    : v7({ msecs: sources.clock().getTime(), rng: sources.random });
}

const systemClock: Clock = () => new Date();

/** The current time in UTC, always as `2026-11-09T14:07:46.297Z`. SQLite orders text by character. */
export function newTimestamp(clock: Clock = systemClock): Instant {
  const value = clock().toISOString();
  const result = instantSchema.safeParse(value);
  if (!result.success) throw new Error(`${value} does not fit a timestamp`);
  return result.data;
}
