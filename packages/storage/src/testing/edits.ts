import { isDeepStrictEqual } from "node:util";
import { ValidationError, type AnySchema, type InferContractRouterInputs } from "@orpc/contract";
import { call, ORPCError } from "@orpc/server";
import type { Migration } from "@self-engine/db";
import { z } from "zod";
import { type RowMap, type StorageContract, type StorageModule } from "../core/index.ts";
import { createSeededDatabase, frameEntry } from "./kit-setup.ts";
import type { Seed } from "./seed.ts";
import { tableContents } from "./table-contents.ts";
import type { ContractViolation } from "./violation.ts";

/** A UUIDv7 no seed produces: counted ids start at the fixed clock, never at its end. */
const UNKNOWN_ID = "ffffffff-ffff-7fff-bfff-ffffffffffff";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function accepts(schema: AnySchema, value: unknown) {
  return !(await schema["~standard"].validate(value)).issues;
}

/** Rule 2 of D329, for every entry with an object input: an unknown field is an input error. */
export async function acceptsUnknownField(schema: AnySchema, example: unknown) {
  if (!isRecord(example)) return false;
  return accepts(schema, { ...example, unknownField: true });
}

/**
 * Checks rules 1 to 3 of the edit pattern (D329, ADR 0032) for every Operation declared with
 * `edit: true`, on a fresh seeded database. The input's required keys are the entry's identity,
 * its optional keys the fields; the answer carries each field under the same name.
 *
 * 1. Without fields the edit answers with the entry as it stands, writes nothing, announces
 *    nothing and leaves `updated_at`; an id no seed produced is not found.
 * 2. With the example, which must set every field, then each field alone: a field the call does
 *    not carry keeps its value, `null` clears an optional field, a value sets it.
 */
export async function checkEdits<Contract extends StorageContract, Rows extends RowMap>(
  module: StorageModule<Contract, Rows>,
  seed: Seed<Rows>,
  examples: Partial<InferContractRouterInputs<Contract>>,
  dependencies: readonly { readonly migrations: readonly Migration[] }[],
): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];
  for (const [entry, definition] of Object.entries(module.entries)) {
    if (definition.kind !== "operation" || definition.edit !== true) continue;
    const example: unknown = Reflect.get(examples, entry);
    if (!isRecord(example)) continue;
    const violate = (rule: string) => {
      if (!violations.some((violation) => violation.entry === entry && violation.rule === rule))
        violations.push({ entry, rule });
    };
    const inputSchema = module.contract[entry]?.["~orpc"].inputSchema;
    if (!(inputSchema instanceof z.ZodObject)) {
      violate("edit input is not an object of an id and fields");
      continue;
    }
    const identity: Record<string, unknown> = {};
    const fields: string[] = [];
    for (const [key, schema] of Object.entries(inputSchema.shape as Record<string, z.ZodType>)) {
      if (schema.safeParse(undefined).success) fields.push(key);
      else identity[key] = example[key];
    }
    for (const field of fields)
      if (!Object.hasOwn(example, field))
        violate(`edit example does not set every field: ${field}`);
    const { database, sources } = await createSeededDatabase(module, dependencies, seed);
    try {
      let announced = false;
      let refusedOutput = false;
      const target = frameEntry(module, entry, {
        database,
        sources,
        checkOutputs: true,
        announce: () => {
          announced = true;
        },
        report: (event) => {
          if (
            event.kind === "unexpected-error" &&
            event.error instanceof ORPCError &&
            event.error.cause instanceof ValidationError
          )
            refusedOutput = true;
        },
      });
      const edit = async (input: Record<string, unknown>) => {
        // The clock moves, so a write without a change still shows in `updated_at`.
        sources.advance(1000);
        return (await call(target, input)) as unknown;
      };

      const answersNothing = (error: unknown) => {
        // An answer the output schema refuses is no entry.
        if (!refusedOutput) throw error;
        refusedOutput = false;
        violate("edit without fields does not answer the entry");
      };
      const before = await tableContents(database);
      announced = false;
      await edit(identity).catch(answersNothing);
      if (announced || !isDeepStrictEqual(before, await tableContents(database)))
        violate("edit without fields writes");
      if (Object.keys(identity).length === 1 && Object.hasOwn(identity, "id")) {
        const unknown = { id: UNKNOWN_ID };
        if (await accepts(inputSchema, unknown)) {
          const notFound = await edit(unknown).then(
            () => false,
            (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND",
          );
          if (!notFound) violate("edit without fields is not 'not found' for an unknown id");
        }
      }

      const set = fields.filter((field) => Object.hasOwn(example, field));
      const full = await edit(example);
      if (!isRecord(full)) continue;
      // After the example the entry is the full edit's answer, `updated_at` included, though the
      // clock has moved on.
      const bare = await edit(identity).catch(answersNothing);
      if (bare !== undefined && !isDeepStrictEqual(bare, full))
        violate("edit without fields does not answer the entry");
      for (const field of set)
        if (!Object.hasOwn(full, field)) violate(`edit answer lacks a field: ${field}`);
      const carried = set.filter((field) => Object.hasOwn(full, field));
      const untouched = (answer: unknown, sent: string) => {
        if (!isRecord(answer)) return;
        for (const field of carried)
          if (field !== sent && !isDeepStrictEqual(answer[field], full[field]))
            violate(`edit changes a field it did not carry: ${field}`);
      };
      for (const field of carried) {
        const cleared = { ...identity, [field]: null };
        if (await accepts(inputSchema, cleared)) {
          const answer = await edit(cleared);
          if (isRecord(answer) && answer[field] !== null)
            violate(`edit does not clear a field sent as null: ${field}`);
          untouched(answer, field);
        }
        const value = { ...identity, [field]: example[field] };
        if (!(await accepts(inputSchema, value))) continue;
        const answer = await edit(value);
        if (isRecord(answer) && !isDeepStrictEqual(answer[field], full[field]))
          violate(`edit does not set a field it carries: ${field}`);
        untouched(answer, field);
      }
    } finally {
      await database.close();
    }
  }
  return violations;
}
