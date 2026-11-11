import type { Health } from "@self-engine/contracts";
import { healthProcedure } from "./procedures/health.ts";
import { refuseUnlessReady } from "./refuse-unless-ready.ts";

export interface RouterOptions {
  readonly health: Health;
}

/**
 * The procedure tree the data process serves; each procedure lives in `procedures/`. In a failure
 * state of the start only `health` answers.
 */
export function createRouter({ health }: RouterOptions) {
  return refuseUnlessReady(health, {
    health: healthProcedure(health),
  });
}
