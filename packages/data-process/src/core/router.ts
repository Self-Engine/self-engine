import type { Health } from "@self-engine/contracts";
import { healthProcedure } from "./procedures/health.ts";
import { tablesChangedProcedure } from "./procedures/tables-changed.ts";
import { refuseUnlessReady } from "./refuse-unless-ready.ts";
import type { TablesChangedPublisher } from "./tables-changed.ts";

export interface RouterOptions {
  readonly health: Health;
  readonly tablesChanged: TablesChangedPublisher;
}

/**
 * The procedure tree the data process serves; each procedure lives in `procedures/`. In a failure
 * state of the start only `health` answers.
 */
export function createRouter({ health, tablesChanged }: RouterOptions) {
  return refuseUnlessReady(health, {
    health: healthProcedure(health),
    tablesChanged: tablesChangedProcedure(tablesChanged),
  });
}
