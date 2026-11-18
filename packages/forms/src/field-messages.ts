import type { I18n, MessageDescriptor } from "@lingui/core";
import { FieldListeners } from "./field-listeners.ts";

/**
 * What a field shows: a descriptor, or a text built in the language of the moment, such as the
 * text of a Reason (D334). Each is turned into text while the field shows it, so it follows a
 * language switch.
 */
export type FieldText = MessageDescriptor | ((i18n: I18n) => string);

/** The text of `message` in the language of `i18n`. */
export function textOf(message: FieldText, i18n: I18n): string {
  return typeof message === "function" ? message(i18n) : i18n._(message);
}

/**
 * The message each field shows, by field name, with one subscription per field: a change to one
 * field's message redraws that field alone, so checking the whole form on every change after a
 * failed save stays cheap (D318, D321).
 */
export class FieldMessages {
  readonly #shown = new Map<string, FieldText>();
  readonly #listeners = new FieldListeners();

  /** The message `field` shows, or `undefined`. */
  of(field: string): FieldText | undefined {
    return this.#shown.get(field);
  }

  /** Calls `listener` when the message of `field` changes; returns the function that stops it. */
  subscribe(field: string, listener: () => void): () => void {
    return this.#listeners.subscribe(field, listener);
  }

  /** Shows `next` in place of every message so far; only the fields whose text changed hear of it. */
  replace(next: ReadonlyMap<string, FieldText>): void {
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
    for (const field of changed) this.#listeners.notify(field);
  }
}

/**
 * The same text with the same numbers: a new check that finds the same violation changes nothing.
 * A built text is the same only as itself.
 */
function sameMessage(a: FieldText | undefined, b: FieldText | undefined): boolean {
  if (a === undefined || b === undefined || typeof a === "function" || typeof b === "function")
    return a === b;
  return a.id === b.id && sameValues(a.values ?? {}, b.values ?? {});
}

/** Key by key, without serializing: a value may be a bigint, which JSON cannot write. */
function sameValues(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}
