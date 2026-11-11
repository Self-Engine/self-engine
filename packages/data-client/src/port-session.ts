import { createORPCClient } from "@orpc/client";
import type { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { AppContract, TablesChanged } from "@self-engine/contracts";

export interface PortSessionEvents {
  /** The stream's first, empty event arrived: the port answers. */
  ready(): void;
  /** A later event: one commit changed these tables. */
  tablesChanged(tables: TablesChanged): void;
  /** The stream ended on its own: the port closed or the data process is gone. */
  lost(): void;
}

export interface PortSession {
  /** Closes the stream without reporting `lost`, because the caller moved on. */
  stop(): void;
}

/**
 * Watches one port through its `tablesChanged` stream: the first event says it is ready, its end
 * says the port is gone. oRPC ends the stream when the port closes, so one signal covers both a
 * closed port and a data process that went away.
 */
export function watchPort(link: RPCLink<object>, events: PortSessionEvents): PortSession {
  const client: ContractRouterClient<AppContract> = createORPCClient(link);
  const stopped = new AbortController();
  void (async () => {
    try {
      const stream = await client.tablesChanged(undefined, { signal: stopped.signal });
      let first = true;
      for await (const tables of stream) {
        if (first) events.ready();
        else events.tablesChanged(tables);
        first = false;
      }
    } catch {
      // The stream fails when its port closes; the end below reports it as a lost port (D190).
    }
    if (!stopped.signal.aborted) events.lost();
  })();
  return { stop: () => stopped.abort() };
}
