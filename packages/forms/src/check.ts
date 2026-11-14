import type { MessageDescriptor } from "@lingui/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { violationText } from "./violation-texts.ts";

/** A Contract's input schema: Zod, read through the Standard Schema interface oRPC uses too. */
export type InputSchema = StandardSchemaV1;

/**
 * What the input schema finds wrong with a draft (D317): the helper's text for each field that
 * breaks a rule, by the field's name, or its dotted path inside a list. A field that breaks
 * several rules shows the first one the schema reports. Empty when the schema accepts the draft.
 */
export function checkDraft(
  schema: InputSchema,
  draft: Readonly<Record<string, unknown>>,
): ReadonlyMap<string, MessageDescriptor> {
  const result = schema["~standard"].validate(draft);
  if (result instanceof Promise) {
    throw new Error(
      "A form checks its draft as the user types, so the Contract's input schema has to check synchronously.",
    );
  }
  const found = new Map<string, MessageDescriptor>();
  for (const issue of result.issues ?? []) {
    const segments = (issue.path ?? []).map((segment) =>
      typeof segment === "object" ? segment.key : segment,
    );
    const field = segments.map(String).join(".");
    if (!found.has(field)) found.set(field, violationText(issue, valueAt(draft, segments)));
  }
  return found;
}

/** The value of the draft at `path`, or `undefined` where the path leads nowhere. */
function valueAt(draft: unknown, path: readonly PropertyKey[]): unknown {
  let value = draft;
  for (const segment of path) {
    if (typeof value !== "object" || value === null) return undefined;
    value = Reflect.get(value, segment);
  }
  return value;
}
