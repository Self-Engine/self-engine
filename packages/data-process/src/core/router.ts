import type { AnyRouter } from "@orpc/server";
import { type Health, PROTOCOL_PROCEDURES, type QueryTables } from "@self-engine/data-protocol";
import { healthProcedure } from "./procedures/health.ts";
import { tablesChangedProcedure } from "./procedures/tables-changed.ts";
import { refuseUnlessReady } from "./refuse-unless-ready.ts";
import type { TablesChangedPublisher } from "./tables-changed.ts";

export interface RouterOptions {
  readonly moduleRouter: Readonly<Record<string, AnyRouter>>;
  readonly health: Health;
  readonly tablesChanged: TablesChangedPublisher;
  /** Sent with the opening event of every Table Change stream (D248). */
  readonly queries: QueryTables;
}

/**
 * The procedure tree the data process serves; each procedure lives in `procedures/`. In a failure
 * state of the start only `health` answers.
 */
export function createRouter({ health, tablesChanged, queries, moduleRouter }: RouterOptions) {
  for (const name of PROTOCOL_PROCEDURES) {
    if (Object.hasOwn(moduleRouter, name))
      throw new Error(`Module namespace conflicts with built-in procedure: ${name}`);
  }
  return refuseUnlessReady(health, {
    ...moduleRouter,
    health: healthProcedure(health),
    tablesChanged: tablesChangedProcedure(tablesChanged, queries),
  });
}
