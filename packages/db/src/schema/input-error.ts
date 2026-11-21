import { z } from "zod";

/** A place in an Operation's input: field names, and indexes inside a list. */
export type InputPath = readonly (string | number)[];

/**
 * The data of an input error an Operation raises itself (D369): the shape of the frame's own check
 * of the input, one custom issue at `path` with `params: { reason }`, so a caller reads both the
 * same way.
 */
export function inputErrorData<const Reason extends string>(path: InputPath, reason: Reason) {
  return {
    issues: [{ code: "custom" as const, path: [...path], message: reason, params: { reason } }],
  };
}

/**
 * The reasons an Operation raises as input errors (D369), for a limit at its input that only the
 * Data Process can judge, such as its "now". A Contract carries it as
 * `.errors({ ...inputErrors("start_in_future"), ...refusal })`: the frame then reports an input
 * error with any other reason as unexpected, and the compiler asks the entry's form for a text for
 * each reason, as it does for a Conflict's. The frame's own check of the input stays an input
 * error of the same shape; its reasons come from the input schema and are not listed here.
 */
export function inputErrors<const Reasons extends readonly [string, ...string[]]>(
  ...reasons: Reasons
) {
  const issue = z.looseObject({
    code: z.literal("custom"),
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
    params: z.looseObject({ reason: z.enum(reasons) }),
  });
  return { BAD_REQUEST: { data: z.looseObject({ issues: z.array(issue).min(1) }) } };
}

/** The reasons a schema of `inputErrors` declares; `never` for any other schema. */
export type InputErrorReason<Data> = Data extends z.ZodType
  ? z.output<Data> extends { readonly issues: readonly (infer Issue)[] }
    ? Issue extends { readonly params: { readonly reason: infer Reason extends string } }
      ? Reason
      : never
    : never
  : never;
