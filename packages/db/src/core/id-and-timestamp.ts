import { v7 } from "uuid";

/** Where the current time comes from. A test supplies its own. */
export type Clock = () => Date;

/** What a test supplies to get a known id. `random` returns 16 bytes. */
export interface IdSources {
  readonly clock: Clock;
  readonly random: () => Uint8Array;
}

/** A new time-ordered UUIDv7. Request the entity id type from its shared schema. */
export function newId<Id extends string = string>(sources?: IdSources): Id {
  // Without sources, uuid keeps a counter that orders ids made within one millisecond.
  // UUID generation establishes validity; the brand records which entity owns this id.
  return (
    sources === undefined ? v7() : v7({ msecs: sources.clock().getTime(), rng: sources.random })
  ) as Id;
}

const systemClock: Clock = () => new Date();

const TIMESTAMP_LENGTH = "2026-11-09T14:07:46.297Z".length;

/** The current time in UTC, always as `2026-11-09T14:07:46.297Z`. SQLite orders text by character. */
export function newTimestamp(clock: Clock = systemClock): string {
  const value = clock().toISOString();
  // Outside the years 0 to 9999, `toISOString` writes a longer year, which would sort wrongly.
  if (value.length !== TIMESTAMP_LENGTH) throw new Error(`${value} does not fit a timestamp`);
  return value;
}
