import { EventPublisher } from "@orpc/server";
import type { TablesChanged } from "@self-engine/data-protocol";

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
      // A missed event would leave a view stale, so this buffer has no limit, which costs nothing:
      // oRPC's server pulls the next event as soon as it posted the last one and never waits
      // for the renderer, so the buffer holds at most the commits of one turn of the event loop.
      // A slow renderer queues events in its port, where no limit here would reach them.
      return publisher.subscribe("tablesChanged", {
        ...(signal === undefined ? {} : { signal }),
        maxBufferedEvents: Number.POSITIVE_INFINITY,
      });
    },
  };
}
