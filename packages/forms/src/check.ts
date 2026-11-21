import type { MessageDescriptor } from "@lingui/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { CATCH_ALL, violationText } from "./violation-texts.ts";

/** A Contract's input schema: Zod, read through the Standard Schema interface oRPC uses too. */
export type InputSchema = StandardSchemaV1;

/**
 * Module-owned descriptors, translated only when a field displays them. `Reason` are the reasons
 * the Operation declares for its own input errors (D369): each needs a text.
 */
export type FormTexts<Field extends string = string, Reason extends string = never> = {
  /** Replaces the helper's generic text at this field. */
  readonly fields?: Partial<Record<Field, MessageDescriptor>>;
} & ([Reason] extends [never]
  ? {
      /**
       * Custom schema issues carry `params: { reason }`; Zod does not expose reasons in its
       * types, so a missing text fails a story, not the compiler.
       */
      readonly reasons?: Readonly<Record<string, MessageDescriptor>>;
    }
  : {
      /**
       * The texts of the reasons of the input schema, as above, and of every reason the
       * Operation declares with `inputErrors`, which the compiler asks for.
       */
      readonly reasons: Readonly<Record<string, MessageDescriptor>> & {
        readonly [Key in Reason]: MessageDescriptor;
      };
    });

/** Who reported an issue, as a missing text names it. */
export type IssueSource = "The input schema" | "The Operation";

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
  return issueTexts(result.issues ?? [], draft, texts, "The input schema");
}

/**
 * The text of each field with an issue, by the field's name or dotted path: of the input schema,
 * or of an input error the Operation answered with (D369), which has the same shape. A reason
 * takes the module's text for it, anything else the helper's text for its kind. A field with
 * several issues shows the first.
 */
export function issueTexts(
  issues: readonly StandardSchemaV1.Issue[],
  draft: Readonly<Record<string, unknown>>,
  texts: FormTexts,
  source: IssueSource,
): ReadonlyMap<string, MessageDescriptor> {
  const found = new Map<string, MessageDescriptor>();
  for (const issue of issues) {
    const segments = (issue.path ?? []).map((segment) =>
      typeof segment === "object" ? segment.key : segment,
    );
    const field = segments.map(String).join(".");
    // Resolve every issue, even a later one at the same field: a missing reason text must
    // fail a story rather than hiding behind the field's first message or an override.
    const reason = reasonOf(issue);
    const reasonText = reason === undefined ? undefined : ownText(texts.reasons, reason);
    if (reason !== undefined && reasonText === undefined) {
      console.error(`${source} reports reason "${reason}", but the form gives no text for it.`);
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
