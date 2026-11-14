import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/** Shown at a field that holds text which is no value, when the field gives no text of its own. */
export const UNFINISHED = msg`Complete or clear this field.`;

/**
 * The fields that hold text which is no value yet, such as "25:00" in a time field (D319). Such a
 * field keeps its older value in the draft, blocks the save, and shows its message once the user
 * has left it or tried to save, until it hands on a finished value.
 */
export class UnfinishedTexts {
  /** The message of each field that holds such text. */
  readonly #held = new Map<string, MessageDescriptor>();
  /** The held fields whose message shows: left, or met by a save. */
  readonly #reported = new Set<string>();
  readonly #listeners = new Set<() => void>();

  /** `field` holds text that is no value; `message` says what to do about it. */
  hold(field: string, message: MessageDescriptor): void {
    const before = this.any();
    this.#held.set(field, message);
    if (!before) this.#tell();
  }

  /** `field` handed on a finished value, or got one by code: its text is a value again. */
  finish(field: string): boolean {
    this.#reported.delete(field);
    if (!this.#held.delete(field)) return false;
    if (!this.any()) this.#tell();
    return true;
  }

  /** The focus left `field`: if it holds such text, its message shows from now on. */
  report(field: string): void {
    if (this.#held.has(field)) this.#reported.add(field);
  }

  /** A save met these fields: each shows its message. */
  reportAll(): void {
    for (const field of this.#held.keys()) this.#reported.add(field);
  }

  /** The message of each field whose message shows. */
  shown(): ReadonlyMap<string, MessageDescriptor> {
    return new Map([...this.#reported].flatMap((field) => this.#entryOf(field)));
  }

  /** Whether any field holds text that is no value: then no save is possible. */
  any(): boolean {
    return this.#held.size > 0;
  }

  /** Calls `listener` whenever `any()` changes; returns the function that stops it. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #entryOf(field: string): [string, MessageDescriptor][] {
    const message = this.#held.get(field);
    return message === undefined ? [] : [[field, message]];
  }

  #tell(): void {
    for (const listener of this.#listeners) listener();
  }
}
