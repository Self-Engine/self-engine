import type { z } from "zod";

/** Kysely tables derived from a module's SQL-named row schemas, including their brands. */
export type TablesOf<Map extends Readonly<Record<string, z.ZodObject>>> = {
  [Table in keyof Map]: z.output<Map[Table]>;
};
