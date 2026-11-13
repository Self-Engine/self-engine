import { newId, type IdSources } from "@self-engine/db";
import type { SpaceId } from "@self-engine/spaces";
import type { Clock, Instant } from "@self-engine/time";
import type { z } from "zod";

/** What a frame builds each call's context from, set once per Data Process. */
export interface ContextSources {
  readonly clock: Clock;
  readonly ids: IdSources;
  /**
   * The Space of every call: the Personal Space the Data Process made sure of at its start. A
   * test takes a fixed one from `@self-engine/spaces/testing`.
   */
  readonly spaceId: SpaceId;
}

export interface StorageContext {
  readonly now: Instant;
  readonly clock: Clock;
  readonly spaceId: SpaceId;
  /** The schema supplies the entity brand; generation never needs a cast in module code. */
  newId<Schema extends z.ZodType<string>>(schema: Schema): z.output<Schema>;
}

export function createContext(sources: ContextSources): StorageContext {
  const moment = sources.clock();
  const clock: Clock = () => moment;
  const ids: IdSources = { clock, random: sources.ids.random };
  return {
    now: moment,
    clock,
    spaceId: sources.spaceId,
    newId: <Schema extends z.ZodType<string>>(_schema: Schema): z.output<Schema> =>
      newId<z.output<Schema>>(ids),
  };
}
