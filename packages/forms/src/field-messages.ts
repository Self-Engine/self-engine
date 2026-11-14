import type { MessageDescriptor } from "@lingui/core";

/**
 * The message each field shows, by field name, with one subscription per field: a change to one
 * field's message redraws that field alone, so checking the whole form on every change after a
 * failed save stays cheap (D318, D321).
 */
export class FieldMessages {
  readonly #shown = new Map<string, MessageDescriptor>();
  readonly #listeners = new Map<string, Set<() => void>>();

  /** The message `field` shows, or `undefined`. */
  of(field: string): MessageDescriptor | undefined {
    return this.#shown.get(field);
  }

  /** Calls `listener` when the message of `field` changes; returns the function that stops it. */
  subscribe(field: string, listener: () => void): () => void {
    const listeners = this.#listeners.get(field) ?? new Set();
    this.#listeners.set(field, listeners);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Shows `next` in place of every message so far; only the fields whose text changed hear of it. */
  replace(next: ReadonlyMap<string, MessageDescriptor>): void {
    const changed = new Set<string>();
    for (const [field, message] of this.#shown) {
      if (!sameMessage(message, next.get(field))) changed.add(field);
    }
    for (const [field, message] of next) {
      if (!sameMessage(message, this.#shown.get(field))) changed.add(field);
    }
    for (const field of changed) {
      const message = next.get(field);
      if (message === undefined) this.#shown.delete(field);
      else this.#shown.set(field, message);
    }
    for (const field of changed)
      for (const listener of this.#listeners.get(field) ?? []) listener();
  }
}

/** The same text with the same numbers: a new check that finds the same violation changes nothing. */
function sameMessage(a: MessageDescriptor | undefined, b: MessageDescriptor | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.id === b.id && JSON.stringify(a.values ?? {}) === JSON.stringify(b.values ?? {});
}
