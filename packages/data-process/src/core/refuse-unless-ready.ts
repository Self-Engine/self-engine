import { type AnyMiddleware, type AnyRouter, enhanceRouter, ORPCError } from "@orpc/server";
import type { Health } from "@self-engine/contracts";

/**
 * The router itself when the start was ready. In a failure state every procedure but `health`
 * refuses its call with `SERVICE_UNAVAILABLE`, carrying the health as data, before its input is
 * checked or its handler runs: the database is not fit to serve them (spec #29).
 */
export function refuseUnlessReady<T extends { readonly health: AnyRouter }>(
  health: Health,
  router: T,
): T {
  if (health.state === "ready") return router;
  const refuse: AnyMiddleware = () => {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: `The data process answers only health while it is in the state ${health.state}`,
      data: health,
    });
  };
  const refused = enhanceRouter(router, {
    middlewares: [refuse],
    errorMap: {},
    dedupeLeadingMiddlewares: false,
  });
  // Enhancing changes only the procedures' middleware, not what they take or answer.
  return { ...(refused as T), health: router.health };
}
