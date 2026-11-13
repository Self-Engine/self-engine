import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";

/** The tables one committed transaction changed, by name. */
export const tablesChangedSchema = z.array(z.string());

export type TablesChanged = z.infer<typeof tablesChangedSchema>;

/**
 * Each Query of the mounted modules with the tables it reads, by module mount name and entry
 * name (D248). An entry that is absent is an Operation.
 */
export const queryTablesSchema = z.record(z.string(), z.record(z.string(), z.array(z.string())));

export type QueryTables = z.infer<typeof queryTablesSchema>;

/**
 * One event of the Table Change stream: first `opened`, once per connection, carrying the
 * Query-to-tables list; then one `changed` per commit that changed tables.
 */
export const tableChangeEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("opened"), queries: queryTablesSchema }),
  z.object({ kind: z.literal("changed"), tables: tablesChangedSchema }),
]);

export type TableChangeEvent = z.infer<typeof tableChangeEventSchema>;

/**
 * One event per commit that changed tables (D92, D193). The stream opens with an `opened`
 * event, so a subscriber knows it is established before any write happens, and learns which
 * entries are Queries and which tables each reads (D248).
 */
export const tablesChangedContract = oc.output(eventIterator(tableChangeEventSchema));
