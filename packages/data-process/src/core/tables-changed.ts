import { EventPublisher } from "@orpc/server";
import type { TablesChanged } from "@self-engine/contracts";

/**
 * Carries each committed transaction's changed tables to every open `tablesChanged` stream.
 * The storage layer announces after each commit (D92, D193); one stream per port listens.
 */
export interface TablesChangedPublisher {
  /** Sends one event naming these tables to every open stream. */
  announce(tables: TablesChanged): void;
  /** The events announced from now on, until `signal` aborts. Nothing announced is dropped. */
  listen(signal: AbortSignal | undefined): AsyncIterable<TablesChanged>;
}

export function createTablesChangedPublisher(): TablesChangedPublisher {
  const publisher = new EventPublisher<{ tablesChanged: TablesChanged }>();
  return {
    announce(tables) {
      publisher.publish("tablesChanged", tables);
    },
    listen(signal) {
      // A missed event would leave a view stale, so a slow stream buffers without a limit.
      return publisher.subscribe("tablesChanged", {
        ...(signal === undefined ? {} : { signal }),
        maxBufferedEvents: Number.POSITIVE_INFINITY,
      });
    },
  };
}
