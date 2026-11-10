import type { I18n, MessageDescriptor } from "@lingui/core";
import { useSyncExternalStore } from "react";
import { clients, NEW_ENTRY_ID } from "./sample-data.ts";

export interface Entry {
  readonly id: string;
  /** Sample entries follow the language until someone renames them. */
  readonly name: MessageDescriptor | string;
}

let entries: readonly Entry[] = clients.map(({ id, entry }) => ({ id, name: entry }));
let created = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** In memory only: this module proves the pattern and stores nothing. */
export const useEntries = () => useSyncExternalStore(subscribe, () => entries);

export function saveEntry(id: string, name: string) {
  entries = entries.some((entry) => entry.id === id)
    ? entries.map((entry) => (entry.id === id ? { id, name } : entry))
    : [...entries, { id: id === NEW_ENTRY_ID ? `entry-${(created += 1)}` : id, name }];
  for (const listener of listeners) listener();
}

export const nameOf = ({ name }: Entry, i18n: I18n) =>
  typeof name === "string" ? name : i18n._(name);
