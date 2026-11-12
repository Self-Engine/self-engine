import type { AnyContractProcedure } from "@orpc/contract";
import type { ORPCError } from "@orpc/server";

/** A conflict's complete data, including its reason, must belong to this entry. */
export async function declaresConflict(
  procedure: AnyContractProcedure,
  error: ORPCError<string, unknown>,
): Promise<boolean> {
  const conflict = procedure["~orpc"].errorMap.CONFLICT;
  if (conflict === undefined || conflict.data === undefined) return false;
  return !(await conflict.data["~standard"].validate(error.data)).issues;
}
