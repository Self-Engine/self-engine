import { createORPCClient, ORPCError } from "@orpc/client";
import type { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  AppContract,
  HealthFailure,
  QueryTables,
  TablesChanged,
} from "@self-engine/contracts";

export interface PortSessionEvents {
  /** The stream's opening event arrived with the Query-to-tables list: the port answers. */
  ready(queries: QueryTables): void;
  /** A later event: one commit changed these tables. */
  tablesChanged(tables: TablesChanged): void;
  /** The stream ended on its own: the port closed or the data process is gone. */
  lost(): void;
  /** The data process answers, but only `health`: its start failed in this state. */
  refused(health: HealthFailure): void;
}

export interface PortSession {
  /** Closes the stream without reporting `lost`, because the caller moved on. */
  stop(): void;
}

/**
 * Watches one port through its `tablesChanged` stream: the opening event says it is ready, its end
 * says the port is gone. oRPC ends the stream when the port closes, so one signal covers both a
 * closed port and a data process that went away.
 */
export function watchPort(link: RPCLink<object>, events: PortSessionEvents): PortSession {
  const client: ContractRouterClient<AppContract> = createORPCClient(link);
  const stopped = new AbortController();
  void (async () => {
    try {
      const stream = await client.tablesChanged(undefined, { signal: stopped.signal });
      for await (const event of stream) {
        if (event.kind === "opened") events.ready(event.queries);
        else events.tablesChanged(event.tables);
      }
    } catch (error) {
      // A refusal means the data process is in a failure state; `health` names it. Any other
      // failure is a closed port, reported below as a lost one (D190).
      if (isRefusal(error)) {
        const health = await client.health(undefined, { signal: stopped.signal }).catch(() => {
          // The port closed before `health` answered: a lost port as well, reported below.
          return undefined;
        });
        if (stopped.signal.aborted) return;
        if (health !== undefined && health.state !== "ready") return events.refused(health);
      }
    }
    if (!stopped.signal.aborted) events.lost();
  })();
  return { stop: () => stopped.abort() };
}

function isRefusal(error: unknown): boolean {
  return error instanceof ORPCError && error.code === "SERVICE_UNAVAILABLE";
}
