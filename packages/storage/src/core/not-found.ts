import { ORPCError } from "@orpc/server";

/**
 * "Not found", as the write paths answer a row they would not find. An Operation raises it itself
 * when its own lookup decides, such as an undo that finds nothing to undo (D349). The frame passes
 * it on as the contract's `NOT_FOUND` and rolls the transaction back.
 */
export function notFound() {
  return new ORPCError("NOT_FOUND");
}
