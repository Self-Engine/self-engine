import type { InferSchemaInput } from "@orpc/contract";
import { call, ORPCError, type AnyProcedure } from "@orpc/server";
import type { TablesOf } from "@self-engine/db";
import { z } from "zod";
import {
  createContext,
  createFrame,
  type RowMap,
  type StorageContract,
  type StorageModule,
} from "../core/index.ts";
import type { ContractViolation } from "./violation.ts";
import type { Seed } from "./seed.ts";
import { createTestContext, createTestDatabase } from "./helpers.ts";

export type ConflictExamples<Contract extends StorageContract, Rows extends RowMap> = {
  readonly [Entry in keyof Contract]?: readonly {
    readonly input: InferSchemaInput<Contract[Entry]["~orpc"]["inputSchema"]>;
    /** Additional setup after the common seed, isolated for each example. */
    readonly prepare?: Seed<Rows>;
  }[];
};

function reasons(schema: unknown): string[] | undefined {
  if (schema instanceof z.ZodLiteral) {
    const values = [...schema.values];
    return values.every((value): value is string => typeof value === "string") ? values : undefined;
  }
  if (schema instanceof z.ZodEnum)
    return Object.values(schema.enum).filter((value): value is string => typeof value === "string");
  if (schema instanceof z.ZodUnion) {
    const parts = schema.options.map((option: unknown) => reasons(option));
    return parts.every((part): part is string[] => part !== undefined) ? parts.flat() : undefined;
  }
  return undefined;
}

export async function checkConflicts<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  seed: Seed<Rows>,
  examples: ConflictExamples<Contract, Rows>,
  dependencies: readonly {
    readonly migrations: StorageModule<Contract, Rows>["migrations"];
  }[] = [],
): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  for (const [entry, procedure] of Object.entries(module.contract)) {
    const conflict = procedure["~orpc"].errorMap.CONFLICT;
    if (conflict === undefined) continue;
    const data = conflict.data;
    const expected = data instanceof z.ZodObject ? reasons(data.shape.reason) : undefined;
    if (expected === undefined || expected.length === 0) {
      violations.push({ entry, rule: "CONFLICT must list reason codes" });
      continue;
    }
    const triggered = new Set<string>();
    const scenarios = examples[entry] ?? [];
    for (const scenario of scenarios) {
      const database = await createTestDatabase(module, dependencies);
      try {
        const sources = createTestContext();
        await database.kysely.transaction().execute(async (transaction) => {
          const tx = transaction.withTables<TablesOf<Rows>>();
          const context = createContext(sources);
          await seed(tx, context);
          await scenario.prepare?.(tx, context);
        });
        let unexpected: { error: unknown } | undefined;
        const router: Record<string, AnyProcedure> = createFrame(module, {
          database,
          sources,
          checkOutputs: true,
          report(event) {
            if (event.kind === "unexpected-error") unexpected = event;
          },
        });
        const target = router[entry];
        if (target === undefined) throw new Error(`Missing module function: ${entry}`);
        try {
          await call(target, scenario.input);
        } catch (error) {
          if (!(error instanceof ORPCError) || error.code !== "CONFLICT")
            throw unexpected === undefined ? error : unexpected.error;
          const parsed = await data?.["~standard"].validate(error.data);
          if (parsed === undefined || parsed.issues)
            violations.push({ entry, rule: "conflict data does not match the declared schema" });
          else if (typeof error.data?.reason === "string") triggered.add(error.data.reason);
        }
      } finally {
        await database.close();
      }
    }
    for (const reason of expected) {
      if (!triggered.has(reason))
        violations.push({ entry, rule: `conflict reason not triggered: ${reason}` });
    }
  }
  return violations;
}
