import type { AnyContractProcedure } from "@orpc/contract";
import type { ORPCError } from "@orpc/server";

/**
 * An expected error's complete data, a Conflict's reason or an input error's reasons included,
 * must belong to this entry: its Contract declares the error's code with data that accepts it.
 */
export async function declaresError(
  procedure: AnyContractProcedure,
  error: ORPCError<string, unknown>,
): Promise<boolean> {
  const declared = procedure["~orpc"].errorMap[error.code];
  if (declared === undefined || declared.data === undefined) return false;
  return !(await declared.data["~standard"].validate(error.data)).issues;
}
