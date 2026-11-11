/**
 * Where the renderer's connection to the data process stands. A crashed data process is a state
 * of the connection, never an error of a call (D190). Each state is one variant, so a later
 * state (a failed migration, a stopped data process) adds a variant with its own details.
 */
export type ConnectionState =
  /** No port has delivered the first event of `tablesChanged` yet. */
  | { readonly status: "connecting" }
  /** The port answers and its `tablesChanged` stream stands. */
  | { readonly status: "ready" }
  /** The port was lost after it had been ready; calls wait for the next port. */
  | { readonly status: "reconnecting" };

export type ConnectionStatus = ConnectionState["status"];

/** A store that React reads with `useSyncExternalStore`, and anything else with `subscribe`. */
export interface ConnectionStateStore {
  /** The current state; the same object until the state changes. */
  getState(): ConnectionState;
  /** Calls `listener` after every change; returns the function that stops it. */
  subscribe(listener: () => void): () => void;
  set(state: ConnectionState): void;
}

export function createConnectionStateStore(initial: ConnectionState): ConnectionStateStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => current,
    subscribe(listener) {
      // A wrapper per subscription, so the same function subscribed twice stops one at a time.
      const entry = () => listener();
      listeners.add(entry);
      return () => listeners.delete(entry);
    },
    set(state) {
      if (state === current) return;
      current = state;
      for (const listener of [...listeners]) listener();
    },
  };
}
