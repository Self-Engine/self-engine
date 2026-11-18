import type { AnyContractProcedure } from "@orpc/contract";
import { refusal } from "@self-engine/db/schema";
import type { ContractViolation } from "./violation.ts";

/**
 * Every Operation carries the Refusal, and a Query does not (D334). The kit compares with the
 * shared building block itself, so a Contract that writes its own `REFUSED`, with codes of its
 * own, fails as one without it.
 */
export function checkRefusal(
  entry: string,
  procedure: AnyContractProcedure,
  kind: "query" | "operation" | undefined,
): ContractViolation[] {
  const carried: unknown = procedure["~orpc"].errorMap.REFUSED;
  if (kind === "operation" && carried !== refusal.REFUSED)
    return [{ entry, rule: "operation does not carry the Refusal" }];
  if (kind === "query" && carried !== undefined)
    return [{ entry, rule: "query carries the Refusal" }];
  return [];
}
