import { newId, type IdSources } from "@self-engine/db";
import { idSchema } from "@self-engine/db/schema";
import type { Clock, Instant } from "@self-engine/time";
import type { z } from "zod";

export const spaceIdSchema = idSchema("Space");
export type SpaceId = z.output<typeof spaceIdSchema>;
export const PERSONAL_SPACE = spaceIdSchema.parse("00000000-0000-7000-8000-000000000001");

export interface ContextSources {
  readonly clock: Clock;
  readonly ids: IdSources;
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
    spaceId: PERSONAL_SPACE,
    newId: <Schema extends z.ZodType<string>>(_schema: Schema): z.output<Schema> =>
      newId<z.output<Schema>>(ids),
  };
}
