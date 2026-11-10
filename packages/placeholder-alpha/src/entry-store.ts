import type { I18n, MessageDescriptor } from "@lingui/core";
import { useSyncExternalStore } from "react";
import { clients, flakyEntry, NEW_ENTRY_ID } from "./sample-data.ts";

export interface Entry {
  readonly id: string;
  /** Sample entries follow the language until someone renames them. */
  readonly name: MessageDescriptor | string;
  /** A deleted entry keeps its place, so that undo brings it back there. */
  readonly deleted?: boolean;
}

let entries: readonly Entry[] = [
  ...clients.map(({ id, entry }) => ({ id, name: entry })),
  flakyEntry,
];
let visible = entries;
let created = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function commit(next: readonly Entry[]) {
  entries = next;
  visible = next.filter((entry) => !entry.deleted);
  for (const listener of listeners) listener();
}

/** In memory only: this module proves the pattern and stores nothing. */
export const useEntries = () => useSyncExternalStore(subscribe, () => visible);

export function saveEntry(id: string, name: string) {
  commit(
    id === NEW_ENTRY_ID
      ? [...entries, { id: `entry-${(created += 1)}`, name }]
      : entries.map((entry) => (entry.id === id ? { ...entry, name } : entry)),
  );
}

const markDeleted = (id: string, deleted: boolean) =>
  commit(entries.map((entry) => (entry.id === id ? { ...entry, deleted } : entry)));

export const deleteEntry = (id: string) => markDeleted(id, true);
export const restoreEntry = (id: string) => markDeleted(id, false);

export const nameOf = ({ name }: Entry, i18n: I18n) =>
  typeof name === "string" ? name : i18n._(name);
