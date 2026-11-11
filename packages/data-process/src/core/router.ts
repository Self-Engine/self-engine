import type { Health } from "@self-engine/contracts";
import { healthProcedure } from "./procedures/health.ts";

export interface RouterOptions {
  readonly health: Health;
}

/** The procedure tree the data process serves; each procedure lives in `procedures/`. */
export function createRouter({ health }: RouterOptions) {
  return {
    health: healthProcedure(health),
  };
}
