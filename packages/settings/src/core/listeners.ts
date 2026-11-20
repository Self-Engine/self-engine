/** The listeners of one adapter: a source starts with the first and stops after the last. */
export interface Listeners<T> {
  /** Adds `listener`, starting the source if it is the first. Returns its unsubscribe function. */
  readonly add: (listener: (value: T) => void) => () => void;
  /** Calls every listener with `value`. */
  readonly emit: (value: T) => void;
  /** Whether anyone listens. */
  readonly active: () => boolean;
}

/** `start` begins listening to the source and returns the function that stops it. */
export function createListeners<T>(start: () => () => void): Listeners<T> {
  const listeners = new Set<(value: T) => void>();
  let stop: (() => void) | undefined;
  return {
    add: (listener) => {
      // A wrapper per subscription, so the same function subscribed twice stops one at a time.
      const entry = (value: T) => listener(value);
      listeners.add(entry);
      stop ??= start();
      return () => {
        if (!listeners.delete(entry) || listeners.size > 0) return;
        stop?.();
        stop = undefined;
      };
    },
    emit: (value) => {
      for (const listener of listeners) listener(value);
    },
    active: () => listeners.size > 0,
  };
}
