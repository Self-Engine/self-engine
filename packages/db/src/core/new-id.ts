import { epochMsOf, type Clock } from "@self-engine/time";
import { v7 } from "uuid";

/** What a test supplies to get a known id. `random` returns 16 bytes. */
export interface IdSources {
  readonly clock: Clock;
  readonly random: () => Uint8Array;
}

/** A new time-ordered UUIDv7. Request the entity id type from its shared schema. */
export function newId<Id extends string = string>(sources: IdSources): Id {
  // UUID generation establishes validity; the brand records which entity owns this id.
  return v7({ msecs: epochMsOf(sources.clock()), rng: sources.random }) as Id;
}
