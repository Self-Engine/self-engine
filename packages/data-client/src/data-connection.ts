import { createORPCClient, DynamicLink } from "@orpc/client";
import { RPCLink, type SupportedMessagePort } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  HealthFailure,
  ProtocolContract,
  QueryTables,
  TablesChanged,
} from "@self-engine/data-protocol";
import {
  type ConnectionState,
  type ConnectionStateStore,
  createConnectionStateStore,
  failureState,
} from "./connection-state.ts";
import { type PortSession, watchPort } from "./port-session.ts";

/**
 * The typed client of the protocol and of the module contracts `Modules`, by mount name. The
 * contracts arrive as types only (D187). The app passes none: Views reach a module through its
 * hooks, typed from its own Contract; a script or test that calls a module directly names it.
 */
export type DataClient<Modules extends object = object> = ContractRouterClient<
  ProtocolContract & Modules
>;

/** A port of the platform: a DOM or Node `MessagePort`, or Electron's `MessagePortMain`. */
export type DataPort = SupportedMessagePort;

/**
 * What the Data Process says about one entry of a mounted module (D248): a Query with the
 * tables it reads, or an Operation. An entry absent from the Data Process's list is an Operation.
 */
export type EntryDescription =
  | { readonly kind: "query"; readonly reads: readonly string[] }
  | { readonly kind: "operation" };

export interface DataConnection<Modules extends object = object> extends Pick<
  ConnectionStateStore,
  "getState" | "subscribe"
> {
  /**
   * One client for the whole session. It sends every call over the port connected last, so a
   * caller keeps it across a new port. A call before the first port, or while reconnecting,
   * waits for the next one.
   */
  readonly client: DataClient<Modules>;
  /** Sends the calls that follow over this port, for example after a reload or a restart. */
  connect(port: DataPort): void;
  /**
   * The current port is gone, for example because the main process saw the data process exit.
   * The connection reconnects: calls wait for the next `connect`.
   */
  disconnect(): void;
  /**
   * The data process is gone and will not come back by itself: it kept crashing (spec #29,
   * Supervision). Calls wait. `disconnect()` waits for a port again, as on a retry; a port that
   * arrives ends the state too.
   */
  stop(): void;
  /**
   * The data process exited in this failure state and is not restarted (spec #29): the main
   * process names it, so a page keeps showing it, and one that loads afterwards shows it too.
   * Calls wait; a port that arrives ends the state.
   */
  fail(failure: HealthFailure): void;
  /**
   * Calls `listener` with the tables of each commit, over whichever port is connected. It does
   * not hear the opening event; returns the function that stops it.
   */
  onTablesChanged(listener: (tables: TablesChanged) => void): () => void;
  /**
   * Whether the entry `entry` of the module mounted as `module` is a Query and which tables it
   * reads, from the list the Data Process sent with the opening event of the last port that got
   * ready. `undefined` until the first port got ready. While reconnecting it keeps the last list;
   * a new port's opening event replaces it before the state turns ready.
   */
  describeEntry(module: string, entry: string): EntryDescription | undefined;
}

const CONNECTING: ConnectionState = { status: "connecting" };
const READY: ConnectionState = { status: "ready" };
const RECONNECTING: ConnectionState = { status: "reconnecting" };
const STOPPED: ConnectionState = { status: "stopped" };
const OPERATION: EntryDescription = { kind: "operation" };

/** The renderer's connection to the data process, platform-neutral: it only needs a port. */
export function createDataConnection<Modules extends object = object>(): DataConnection<Modules> {
  const state = createConnectionStateStore(CONNECTING);
  const tablesListeners = new Set<(tables: TablesChanged) => void>();
  let nextLink = pendingLink();
  let currentLink: Promise<RPCLink<object>> = nextLink.promise;
  let session: PortSession | undefined;
  let wasReady = false;
  let queries: QueryTables | undefined;

  function waiting(): ConnectionState {
    return wasReady ? RECONNECTING : CONNECTING;
  }

  /** Drops the current port: calls wait for the next one. */
  function dropSession(): void {
    // Without a port, calls already wait on the pending link; a new one would strand them.
    if (session === undefined) return;
    session.stop();
    session = undefined;
    nextLink = pendingLink();
    currentLink = nextLink.promise;
  }

  function loseSession(): void {
    dropSession();
    state.set(waiting());
  }

  return {
    client: createORPCClient(new DynamicLink(({ signal }) => waitForLink(currentLink, signal))),
    getState: () => state.getState(),
    subscribe: (listener) => state.subscribe(listener),
    connect(port) {
      session?.stop();
      // A new port starts over: whatever the last one ended in, the connection waits for it.
      const current = state.getState().status;
      if (current !== "connecting" && current !== "reconnecting") state.set(waiting());
      const link = new RPCLink({ port });
      if ("start" in port && typeof port.start === "function") port.start();
      nextLink.resolve(link);
      currentLink = Promise.resolve(link);
      const own: PortSession = watchPort(link, {
        ready(list) {
          queries = list;
          wasReady = true;
          state.set(READY);
        },
        tablesChanged(tables) {
          for (const listener of tablesListeners) listener(tables);
        },
        lost() {
          if (session === own) loseSession();
        },
        refused(health) {
          if (session === own) state.set(failureState(health));
        },
      });
      session = own;
    },
    disconnect() {
      if (session !== undefined || state.getState().status !== "connecting") loseSession();
    },
    stop() {
      dropSession();
      state.set(STOPPED);
    },
    fail(failure) {
      dropSession();
      const current = state.getState();
      const known = "migration" in current && current.status === failure.state;
      if (!known || current.migration !== failure.migration) state.set(failureState(failure));
    },
    onTablesChanged(listener) {
      const entry = (tables: TablesChanged) => listener(tables);
      tablesListeners.add(entry);
      return () => tablesListeners.delete(entry);
    },
    describeEntry(module, entry) {
      if (queries === undefined) return undefined;
      const reads = Object.hasOwn(queries, module) ? queries[module] : undefined;
      if (reads === undefined || !Object.hasOwn(reads, entry)) return OPERATION;
      return { kind: "query", reads: reads[entry]! };
    },
  };
}

interface PendingLink {
  readonly promise: Promise<RPCLink<object>>;
  resolve(link: RPCLink<object>): void;
}

function pendingLink(): PendingLink {
  let resolve: (link: RPCLink<object>) => void = () => {};
  const promise = new Promise<RPCLink<object>>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Cancellation belongs to one caller, never to the shared pending port. */
async function waitForLink(
  link: Promise<RPCLink<object>>,
  signal: AbortSignal | undefined,
): Promise<RPCLink<object>> {
  if (!signal) return link;
  signal.throwIfAborted();
  let abort = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([link, cancelled]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
