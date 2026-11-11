import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";

/** The tables one committed transaction changed, by name. */
export const tablesChangedSchema = z.array(z.string());

export type TablesChanged = z.infer<typeof tablesChangedSchema>;

/**
 * One event per commit that changed tables (D92, D193). The stream opens with one empty event,
 * so a subscriber knows it is established before any write happens.
 */
export const tablesChangedContract = oc.output(eventIterator(tablesChangedSchema));
