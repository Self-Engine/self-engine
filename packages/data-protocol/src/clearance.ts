import { oc } from "@orpc/contract";
import { clearanceWriteSchema, rowClearanceSchema } from "@self-engine/db/schema";
import { z } from "zod";

/**
 * The Clearance (D339): a Query of the Data Process, the same for every module, which answers
 * beforehand which kinds of write are blocked for these rows of this table, and why. It asks the
 * same Protection Rules as the write paths, once per kind of write for every row, and writes
 * nothing. A table no mounted module has, a Local Table, or archive and unarchive of a table that
 * cannot be archived is invalid input (`BAD_REQUEST`).
 */
export const clearanceContract = oc
  .input(
    z.strictObject({
      table: z.string().min(1),
      rows: z.array(z.string()).min(1),
      writes: z.array(clearanceWriteSchema).min(1),
    }),
  )
  .output(z.array(rowClearanceSchema));
