import type { TablesChanged } from "@self-engine/data-protocol";
import type { DataConnection, EntryDescription } from "../data-connection.ts";

/**
 * Everything the building block needs from the Data Process (D249). The app passes the real one
 * (`portAccessOf`), a story or test substitutes its own, so the hooks never reach for a
 * connection themselves.
 */
export interface PortAccess {
  /** Calls the entry `entry` of the module mounted as `module`; rejects with its error. */
  call(module: string, entry: string, input: unknown, signal?: AbortSignal): Promise<unknown>;
  /** Whether the entry is a Query and which tables it reads; `undefined` until connected. */
  describeEntry(module: string, entry: string): EntryDescription | undefined;
  /** Calls `listener` with the tables of each Table Change; returns the function that stops it. */
  onTablesChanged(listener: (tables: TablesChanged) => void): () => void;
  /**
   * Calls `listener` each time the connection is ready again after it was lost, when Table
   * Changes may have gone missing (D250). Returns the function that stops it.
   */
  onReconnected(listener: () => void): () => void;
}

/**
 * A Port access with no Data Process behind it: every call fails at once, no Table Change and no
 * reconnect ever come, and no entry is known. The web app uses it while it has no Data Process,
 * so nothing waits behind the state it shows instead (D263); a test or story uses it where no
 * call is meant to reach a Port, and Fixed Answers build on it.
 */
export const NO_DATA_PROCESS: PortAccess = {
  call: (module, entry) =>
    Promise.reject(new Error(`No Data Process answers ${module}.${entry} on this page`)),
  describeEntry: () => undefined,
  onTablesChanged: () => () => undefined,
  onReconnected: () => () => undefined,
};

/** One procedure of the client, reached by its module and entry name. */
type Procedure = (input: unknown, options: { signal?: AbortSignal }) => Promise<unknown>;

/** The Port access over the real connection to the Data Process. */
export function portAccessOf(connection: DataConnection): PortAccess {
  // The app contract types only the cross-module procedures; a module's entries are reached by
  // name through the client's proxy, typed by the hook from the module's own Contract.
  const client = connection.client as unknown as Readonly<
    Record<string, Readonly<Record<string, Procedure>>>
  >;
  return {
    call(module, entry, input, signal) {
      const procedure = client[module]?.[entry];
      if (procedure === undefined) return Promise.reject(new Error(`No entry ${module}.${entry}`));
      return procedure(input, signal === undefined ? {} : { signal });
    },
    describeEntry: (module, entry) => connection.describeEntry(module, entry),
    onTablesChanged: (listener) => connection.onTablesChanged(listener),
    onReconnected(listener) {
      // A port got ready once exactly when the Query-to-tables list arrived. Any state but ready
      // after that lost the stream: reconnecting, stopped or failed.
      let lost = connection.getState().status !== "ready" && connection.hasQueryList();
      return connection.subscribe(() => {
        if (connection.getState().status !== "ready") {
          lost = connection.hasQueryList();
          return;
        }
        if (!lost) return;
        lost = false;
        listener();
      });
    },
  };
}
