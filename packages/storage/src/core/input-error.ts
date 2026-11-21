import { ORPCError } from "@orpc/server";
import { inputErrorData, type InputPath } from "@self-engine/db/schema";

/**
 * An input error an Operation raises itself, for a limit only the Data Process knows, such as its
 * "now" (D348, D369): the same shape as the frame's check of the input, one custom issue at `path`
 * with `params: { reason }`, so a caller reads it like any other input error. The entry declares
 * the reason with `inputErrors` of `@self-engine/db/schema`; the frame passes the error on, rolls
 * the transaction back, and reports a reason the entry does not declare.
 */
export function inputError(path: InputPath, reason: string) {
  return new ORPCError("BAD_REQUEST", {
    message: "Input validation failed",
    data: inputErrorData(path, reason),
  });
}
