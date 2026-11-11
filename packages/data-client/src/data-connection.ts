import { createORPCClient, DynamicLink } from "@orpc/client";
import { RPCLink, type SupportedMessagePort } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { AppContract, TablesChanged } from "@self-engine/contracts";
import {
  type ConnectionState,
  type ConnectionStateStore,
  createConnectionStateStore,
} from "./connection-state.ts";
import { type PortSession, watchPort } from "./port-session.ts";

/** The typed client of the app contract. The contract arrives as a type only (D187). */
export type DataClient = ContractRouterClient<AppContract>;

/** A port of the platform: a DOM or Node `MessagePort`, or Electron's `MessagePortMain`. */
export type DataPort = SupportedMessagePort;

export interface DataConnection extends Pick<ConnectionStateStore, "getState" | "subscribe"> {
  /**
   * One client for the whole session. It sends every call over the port connected last, so a
   * caller keeps it across a new port. A call before the first port, or while reconnecting,
   * waits for the next one.
   */
  readonly client: DataClient;
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
   * Calls `listener` with the tables of each commit, over whichever port is connected. It does
   * not hear the opening empty event; returns the function that stops it.
   */
  onTablesChanged(listener: (tables: TablesChanged) => void): () => void;
}

const CONNECTING: ConnectionState = { status: "connecting" };
const READY: ConnectionState = { status: "ready" };
const RECONNECTING: ConnectionState = { status: "reconnecting" };
const STOPPED: ConnectionState = { status: "stopped" };

/** The renderer's connection to the data process, platform-neutral: it only needs a port. */
export function createDataConnection(): DataConnection {
  const state = createConnectionStateStore(CONNECTING);
  const tablesListeners = new Set<(tables: TablesChanged) => void>();
  let nextLink = pendingLink();
  let currentLink: Promise<RPCLink<object>> = nextLink.promise;
  let session: PortSession | undefined;
  let wasReady = false;

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
    client: createORPCClient(new DynamicLink(() => currentLink)),
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
        ready() {
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
          if (session === own) state.set({ status: health.state, migration: health.migration });
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
    onTablesChanged(listener) {
      const entry = (tables: TablesChanged) => listener(tables);
      tablesListeners.add(entry);
      return () => tablesListeners.delete(entry);
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
