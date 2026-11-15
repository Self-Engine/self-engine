import { declaresConflict } from "../core/conflict-declared.ts";
import { checkConflicts, type ConflictExamples } from "./conflicts.ts";
import { acceptsUnknownField, checkEdits } from "./edits.ts";
import { seedScoping, returnsSeededRow, checkEntryScoping, scopedRowsChanged } from "./scoping.ts";
import { isDeepStrictEqual } from "node:util";
import type { InferContractRouterInputs } from "@orpc/contract";
import { call, ORPCError } from "@orpc/server";
import { uniqueIndexes, type TablesOf } from "@self-engine/db";
import { CompiledQuery, type Transaction } from "kysely";
import { z } from "zod";
import {
  createContext,
  type RowMap,
  type StorageContract,
  type StorageModule,
} from "../core/index.ts";
import { tableContents } from "./table-contents.ts";
import { checkActiveQuery } from "./active.ts";
import { QueryWriteError } from "../core/table-writes.ts";
import { recordTableReads } from "./table-reads.ts";
import { createTestDatabase } from "./helpers.ts";
import { createSeededDatabase, frameEntry } from "./kit-setup.ts";

import type { ContractViolation } from "./violation.ts";
export type { ContractViolation } from "./violation.ts";
export type { Seed } from "./seed.ts";
import type { Seed } from "./seed.ts";

function candidates(example: unknown): unknown[] {
  const values: unknown[] = [undefined, 42, "invalid", null, {}, [], true];
  if (typeof example === "object" && example !== null && !Array.isArray(example)) {
    for (const [key, value] of Object.entries(example)) {
      const omitted = { ...example };
      Reflect.deleteProperty(omitted, key);
      values.push(omitted, { ...example, [key]: typeof value === "string" ? 42 : "invalid" });
    }
  }
  return values.filter((value) => !Object.is(value, example));
}

// Inspect schema definitions as well as the example: a default or a no-op transform can
// leave that particular output unchanged and must still be forbidden (D188).
function convertsOutput(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== "object" || value === null || seen.has(value)) return false;
  seen.add(value);
  if (value instanceof z.ZodLazy) return convertsOutput(value.unwrap(), seen);
  if ("_zod" in value && typeof value._zod === "object" && value._zod !== null)
    return convertsOutput(Reflect.get(value._zod, "def"), seen);
  if ("type" in value && ["transform", "default", "prefault", "catch"].includes(String(value.type)))
    return true;
  if (
    ("coerce" in value && value.coerce === true) ||
    ("check" in value && value.check === "overwrite")
  )
    return true;
  return Object.values(value).some((child: unknown) => convertsOutput(child, seen));
}

/**
 * Checks a module with fresh in-memory SQLite per entry and only valid example inputs.
 * Every table whose contents change must be announced. Announced tables whose contents
 * remain byte-identical are allowed: rewriting the same values still affects rows.
 * Queries must not write, even when their attempted write would affect zero rows.
 * Invalid candidates are fixed wrong-typed values (undefined, number, string, null, object,
 * array, boolean), plus object examples with each top-level key removed and each top-level
 * value replaced by another type. Candidates differing from the example that its input
 * schema rejects must be rejected by the frame before the module function runs, with both
 * output-check settings. At least one candidate must be rejected; otherwise the entry
 * fails with "accepts invalid input". Entries without input accept only undefined.
 */
export async function checkContract<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  seed: Seed<Rows>,
  examples: Partial<InferContractRouterInputs<Contract>>,
  conflictExamples: ConflictExamples<Contract, Rows> = {},
  dependencies: readonly {
    readonly migrations: StorageModule<Contract, Rows>["migrations"];
  }[] = [],
): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  const schemaDatabase = await createTestDatabase(module, dependencies);
  try {
    const indexes = await uniqueIndexes(schemaDatabase, Object.keys(module.rowMap));
    for (const columns of new Set(indexes.map((index) => index.columns))) {
      // Expression indexes are named in SQLite's diagnostic and remain distinguishable.
      if (columns === undefined) continue;
      const matching = indexes.filter((index) => index.columns === columns);
      const reasons = new Set(
        matching
          .map((index) => module.conflicts?.[index.name])
          .filter((reason) => reason !== undefined),
      );
      if (reasons.size > 1)
        violations.push({
          entry: matching
            .map((index) => index.name)
            .sort()
            .join(", "),
          rule: "same-column unique indexes map to different conflict reasons",
        });
    }
    for (const index of indexes) {
      if (!module.conflicts?.[index.name])
        violations.push({ entry: index.name, rule: "unique index has no conflict reason" });
    }
  } finally {
    await schemaDatabase.close();
  }
  for (const [entry, procedure] of Object.entries(module.contract)) {
    if (!Object.hasOwn(examples, entry)) {
      violations.push({ entry, rule: "missing example" });
      continue;
    }
    const outputSchema = procedure["~orpc"].outputSchema;
    const converts = convertsOutput(outputSchema);
    if (converts) violations.push({ entry, rule: "output schema transforms or defaults a value" });
    const example: unknown = Reflect.get(examples, entry);
    const inputSchema = procedure["~orpc"].inputSchema ?? z.undefined();
    const invalid: unknown[] = [];
    for (const candidate of candidates(example)) {
      if (!(await inputSchema["~standard"].validate(candidate)).issues) continue;
      invalid.push(candidate);
    }
    if (invalid.length === 0) violations.push({ entry, rule: "accepts invalid input" });
    if (await acceptsUnknownField(inputSchema, example))
      violations.push({ entry, rule: "input accepts an unknown field" });
    const { database, sources } = await createSeededDatabase(module, dependencies, seed);
    try {
      const definition = module.entries[entry];
      if (definition?.kind === "query" && definition.list?.kind === "pages") {
        const queries = definition.list.queries;
        if (queries !== undefined) {
          try {
            const compiled = await database.kysely
              .transaction()
              .execute((tx) =>
                Promise.resolve(
                  queries(
                    tx.withTables<TablesOf<Rows>>(),
                    createContext(sources),
                    example as never,
                    entry,
                    module.name,
                  ),
                ),
              );
            for (const [index, query] of compiled.entries()) {
              const plan = await database.kysely.executeQuery<{ detail: string }>(
                CompiledQuery.raw(`EXPLAIN QUERY PLAN ${query.sql}`, [...query.parameters]),
              );
              if (plan.rows.some(({ detail }) => /TEMP B-TREE.*ORDER BY/i.test(detail))) {
                violations.push({ entry, rule: "page query sorts without an index" });
                break;
              }
              if (
                index > 0 &&
                !plan.rows.some(({ detail }) =>
                  /(?:USING (?:COVERING )?INDEX|USING INTEGER PRIMARY KEY).*\b(?!space_id\b)\w+\)?[<>]/i.test(
                    detail,
                  ),
                )
              ) {
                violations.push({
                  entry,
                  rule: "page cursor query has no index range beyond space_id",
                });
                break;
              }
            }
          } catch (error) {
            if (!(error instanceof Error) || !/ambiguous column name/i.test(error.message))
              throw error;
            violations.push({
              entry,
              rule: "page list has an ambiguous sort column; wrap the join in a subquery",
            });
            continue;
          }
        }
      }
      let baseline: unknown;
      if (definition?.kind === "query") {
        const { database: isolated, sources: isolatedSources } = await createSeededDatabase(
          module,
          dependencies,
          seed,
          async (transaction) => {
            const tx = transaction.withTables<Record<string, { deleted_at: string | null }>>();
            for (const [table, schema] of Object.entries(module.rowMap)) {
              if (!table.startsWith("local_") && Object.hasOwn(schema.shape, "deleted_at"))
                await tx.deleteFrom(table).where("deleted_at", "is not", null).execute();
            }
          },
        );
        try {
          const isolatedTarget = frameEntry(module, entry, {
            database: isolated,
            sources: isolatedSources,
            checkOutputs: false,
          });
          try {
            baseline = { output: await call(isolatedTarget, example) };
          } catch (error) {
            if (!(error instanceof ORPCError)) throw error;
            baseline = { code: error.code, data: error.data };
          }
        } finally {
          await isolated.close();
        }
      }
      violations.push(...(await checkEntryScoping(module, seed, entry, example, dependencies)));
      if (definition?.kind === "query" && definition.active === true)
        violations.push(...(await checkActiveQuery(module, seed, entry, example, dependencies)));
      const scoped = await seedScoping(database, module.rowMap, seed, createContext(sources));
      let calls = 0;
      const read = new Set<string>();
      const observed = {
        ...module,
        entries: Object.fromEntries(
          Object.entries(module.entries).map(([name, definition]) => [
            name,
            {
              ...definition,
              run: (tx: Transaction<TablesOf<Rows>>, ...rest: never[]) => {
                calls++;
                // The module definition checked each lower function; this wrapper only forwards.
                const run = definition.run as (tx: unknown, ...rest: never[]) => unknown;
                // Only the kit records reads; the frame in the app runs queries without it.
                return run(
                  definition.kind === "query" ? tx.withPlugin(recordTableReads(read)) : tx,
                  ...rest,
                );
              },
            },
          ]),
        ),
      } as StorageModule<Contract, Rows>;
      const realTables = new Set(
        (await database.kysely.introspection.getTables())
          .filter((table) => !table.isView)
          .map((table) => table.name),
      );
      const checkReads = () => {
        if (definition?.kind !== "query") return;
        const declared = new Set(definition.reads);
        for (const table of [...read].sort())
          if (realTables.has(table) && !declared.has(table))
            violations.push({ entry, rule: `query reads an undeclared table: ${table}` });
      };
      for (const checkOutputs of [true, false]) {
        const target = frameEntry(observed, entry, { database, sources, checkOutputs });
        for (const candidate of invalid) {
          calls = 0;
          let rejected = false;
          try {
            await call(target, candidate);
          } catch (error) {
            rejected = error instanceof ORPCError && error.code === "BAD_REQUEST";
          }
          if (!rejected || calls !== 0) {
            violations.push({ entry, rule: "accepts invalid input" });
            break;
          }
        }
      }
      let queryWrite = false;
      const announced = new Set<string>();
      const before = await tableContents(database);
      const target = frameEntry(observed, entry, {
        database,
        sources,
        checkOutputs: false,
        report: (event) => {
          if (event.kind === "unexpected-error" && event.error instanceof QueryWriteError)
            queryWrite = true;
        },
        announce: (tables) => {
          for (const table of tables) announced.add(table);
        },
      });
      let output: unknown;
      read.clear();
      try {
        output = await call(target, example);
        checkReads();
      } catch (error) {
        if (queryWrite) {
          violations.push({ entry, rule: "query writes" });
          continue;
        }
        if (
          definition?.kind !== "query" ||
          !(error instanceof ORPCError) ||
          error.code !== "NOT_FOUND"
        )
          throw error;
        checkReads();
        if (!isDeepStrictEqual(baseline, { code: error.code, data: error.data }))
          violations.push({ entry, rule: "query output changes with foreign or deleted rows" });
        continue;
      }
      if (definition?.kind === "operation") {
        try {
          await call(target, example);
        } catch (error) {
          if (
            error instanceof ORPCError &&
            error.code === "CONFLICT" &&
            !(await declaresConflict(procedure, error))
          )
            violations.push({ entry, rule: "operation returns an undeclared conflict or reason" });
        }
      }
      if (definition?.kind === "query" && Array.isArray(output) && definition.list === undefined)
        violations.push({ entry, rule: "array query has no list kind" });
      const after = await tableContents(database);
      if (definition?.kind === "operation") {
        if (scopedRowsChanged(before, after, scoped.foreign))
          violations.push({ entry, rule: "operation changes a row from another Space" });
        if (scopedRowsChanged(before, after, scoped.deleted))
          violations.push({ entry, rule: "operation changes a deleted row" });
      }

      for (const [table, rows] of after) {
        if (isDeepStrictEqual(before.get(table), rows)) continue;
        if (module.entries[entry]?.kind === "query") {
          violations.push({ entry, rule: "query writes" });
          break;
        }
        if (!announced.has(table))
          violations.push({ entry, rule: `changed table not announced: ${table}` });
      }
      if (definition?.kind === "query" && !isDeepStrictEqual(baseline, { output }))
        violations.push({ entry, rule: "query output changes with foreign or deleted rows" });
      if (scoped !== undefined) {
        if (returnsSeededRow(output, scoped.foreign))
          violations.push({ entry, rule: "returns a row from another Space" });
        if (returnsSeededRow(output, scoped.deleted))
          violations.push({ entry, rule: "returns a deleted row" });
      }
      if (outputSchema !== undefined) {
        const parsed = await outputSchema["~standard"].validate(output);
        if (parsed.issues) violations.push({ entry, rule: "output does not match contract" });
        else if (!converts && !isDeepStrictEqual(output, parsed.value))
          violations.push({ entry, rule: "output contains fields outside the contract" });
      }
    } finally {
      await database.close();
    }
  }
  violations.push(...(await checkConflicts(module, seed, conflictExamples, dependencies)));
  violations.push(...(await checkEdits(module, seed, examples, dependencies)));
  return violations;
}
