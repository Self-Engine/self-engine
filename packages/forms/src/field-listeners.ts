/**
 * Listeners by field name: how each field hears of a change to itself alone, so a change to one
 * field redraws no other (D318).
 */
export class FieldListeners {
  readonly #listeners = new Map<string, Set<() => void>>();

  /** Calls `listener` at each `notify(field)`; returns the function that stops it. */
  subscribe(field: string, listener: () => void): () => void {
    const listeners = this.#listeners.get(field) ?? new Set();
    this.#listeners.set(field, listeners);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Tells the listeners of `field`. */
  notify(field: string): void {
    for (const listener of this.#listeners.get(field) ?? []) listener();
  }
}
