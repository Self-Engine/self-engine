import { z } from "zod";

/** Only "blocking" is produced so far; "warning" belongs to the format (D338). */
export const severities = ["blocking", "warning"] as const;
export type Severity = (typeof severities)[number];

/**
 * A Reason, defined once by the package that owns it (D334): a fixed code and the schema of its
 * details. A Protection Rule names the definitions it answers with; a page matches one.
 */
export interface ReasonDefinition<
  Code extends string = string,
  Details extends z.ZodType = z.ZodType,
> {
  readonly code: Code;
  readonly details: Details;
}

export function defineReason<const Code extends string, Details extends z.ZodType>(
  code: Code,
  details: Details,
): ReasonDefinition<Code, Details> {
  return { code, details };
}

/** Why a write is refused: its code, severity, the id of the row, optionally a field, and details. */
export interface Reason<Code extends string = string, Details = unknown> {
  readonly code: Code;
  readonly severity: Severity;
  readonly row: string;
  readonly field?: string | undefined;
  readonly details: Details;
}

export type ReasonOf<Definition extends ReasonDefinition> =
  Definition extends ReasonDefinition<infer Code, infer Details>
    ? Reason<Code, z.output<Details>>
    : never;

const reasonSchema = z.object({
  code: z.string(),
  severity: z.enum(severities),
  row: z.string(),
  field: z.string().optional(),
  details: z.unknown(),
});

/**
 * The Refusal, the third expected failure beside "not found" and a Conflict (D334): the same
 * shape for every Operation, a list of Reasons. A Contract carries it as `.errors({ ...refusal })`;
 * it lists no codes, so a rule registered from above never changes the Contract.
 */
export const refusal = {
  REFUSED: { status: 422, data: z.object({ reasons: z.array(reasonSchema).min(1) }) },
};

/**
 * The Reason of the reference check, which the storage frame brings itself (D337): Live Rows
 * still refer to the row, so it is not deleted. It names each referring table with its count.
 */
export const referenced = defineReason(
  "referenced",
  z.object({
    tables: z.array(z.object({ table: z.string(), count: z.number().int().positive() })).min(1),
  }),
);

/**
 * The other Reason of the reference check (D337): a written or restored reference names a row
 * that is deleted, unknown or of another Space. Its field is the referring column; the details
 * name the target, so that a caller can say what has to come back first.
 */
export const targetDeleted = defineReason(
  "target_deleted",
  z.object({ target: z.object({ table: z.string(), id: z.string() }) }),
);

/** The Reason with its details typed, when it is the defined one and its details fit. */
export function matchReason<Definition extends ReasonDefinition>(
  definition: Definition,
  reason: Reason,
): ReasonOf<Definition> | undefined {
  if (reason.code !== definition.code) return undefined;
  const details = definition.details.safeParse(reason.details);
  // The code and the parsed details are the definition's own.
  return details.success
    ? ({ ...reason, details: details.data } as ReasonOf<Definition>)
    : undefined;
}
