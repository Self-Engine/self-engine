import { ORPCError } from "@orpc/server";

/**
 * An input error an Operation raises itself, for a limit only the Data Process knows, such as its
 * "now" (D348): the same shape as the frame's check of the input, one custom issue at `path` with
 * `params: { reason }`, so a caller reads it like any other input error. The frame passes it on
 * and rolls the transaction back.
 */
export function inputError(path: readonly (string | number)[], reason: string) {
  return new ORPCError("BAD_REQUEST", {
    message: "Input validation failed",
    data: { issues: [{ code: "custom", path, message: reason, params: { reason } }] },
  });
}
