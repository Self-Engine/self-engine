import type { MessageDescriptor } from "@lingui/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { CATCH_ALL, violationText } from "./violation-texts.ts";

/** A Contract's input schema: Zod, read through the Standard Schema interface oRPC uses too. */
export type InputSchema = StandardSchemaV1;

/** Module-owned descriptors, translated only when a field displays them. */
export interface FormTexts<Field extends string = string> {
  /** Replaces the helper's generic text at this field. */
  readonly fields?: Partial<Record<Field, MessageDescriptor>>;
  /** Custom schema issues carry `params: { reason }`; Zod does not expose reasons in its types. */
  readonly reasons?: Readonly<Record<string, MessageDescriptor>>;
}

/**
 * What the input schema finds wrong with a draft (D317): the helper's text for each field that
 * breaks a rule, by the field's name, or its dotted path inside a list. A field that breaks
 * several rules shows the first one the schema reports. Empty when the schema accepts the draft.
 */
export function checkDraft(
  schema: InputSchema,
  draft: Readonly<Record<string, unknown>>,
  texts: FormTexts = {},
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
    // Resolve every issue, even a later one at the same field: a missing reason text must
    // fail a story rather than hiding behind the field's first message or an override.
    const reason = reasonOf(issue);
    const reasonText = reason === undefined ? undefined : ownText(texts.reasons, reason);
    if (reason !== undefined && reasonText === undefined) {
      console.error(
        `The input schema reports reason "${reason}", but the form gives no text for it.`,
      );
    }
    const text =
      reason === undefined
        ? (ownText(texts.fields, field) ?? violationText(issue, valueAt(draft, segments)))
        : (reasonText ?? CATCH_ALL);
    if (!found.has(field)) found.set(field, text);
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

/** Read the Contract's custom reason without depending on Zod at runtime. */
function reasonOf(issue: StandardSchemaV1.Issue): string | undefined {
  const params: unknown = Reflect.get(issue, "params");
  if (Reflect.get(issue, "code") !== "custom" || typeof params !== "object" || params === null) {
    return undefined;
  }
  const reason: unknown = Reflect.get(params, "reason");
  return typeof reason === "string" ? reason : undefined;
}

/** Schema names are data; inherited object properties are never message descriptors. */
function ownText(
  texts: Readonly<Record<string, MessageDescriptor | undefined>> | undefined,
  key: string,
): MessageDescriptor | undefined {
  return texts !== undefined && Object.hasOwn(texts, key) ? texts[key] : undefined;
}
