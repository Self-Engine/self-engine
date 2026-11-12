// Test support only, imported by the hook tests: renders a Port hook against a substituted Port
// access whose answers, Table Changes and reconnects a test drives by hand (D249). Fake timers
// stand in for the clock: the query library batches its updates on `setTimeout(0)`.

import type { QueryTables, TablesChanged } from "@self-engine/contracts";
import type { MessageDescriptor } from "@lingui/core";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vite-plus/test";
import { DataProvider, type DataProviderProps } from "./provider.ts";
import type { PortAccess } from "./port-access.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** The Queries of the `notes` test module and the tables they read; every other entry operates. */
const NOTES_QUERIES: QueryTables = {
  notes: { list: ["notes"], get: ["notes"], window: ["notes"] },
};

export interface Call {
  readonly module: string;
  readonly entry: string;
  readonly input: unknown;
}

export interface FakePort {
  readonly access: PortAccess;
  readonly calls: Call[];
  /**
   * What each entry of `notes` answers; called once per call, so every answer is a new object.
   * A thrown error or a rejected promise is the entry's error.
   */
  answer(entry: string, run: (input: unknown) => unknown): void;
  /** Delivers a Table Change, as the Data Process does after a commit. */
  changeTables(tables: TablesChanged): void;
  /** Reports a reconnect to the Data Process. */
  reconnect(): void;
}

export function fakePort(queries: QueryTables = NOTES_QUERIES): FakePort {
  const calls: Call[] = [];
  const answers = new Map<string, (input: unknown) => unknown>();
  const tablesListeners = new Set<(tables: TablesChanged) => void>();
  const reconnectListeners = new Set<() => void>();
  return {
    calls,
    access: {
      call(module, entry, input) {
        calls.push({ module, entry, input });
        const run = answers.get(`${module}.${entry}`);
        if (run === undefined) return Promise.reject(new Error(`No answer for ${entry}`));
        try {
          return Promise.resolve(run(input));
        } catch (error) {
          return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      describeEntry(module, entry) {
        const reads = queries[module]?.[entry];
        return reads === undefined ? { kind: "operation" } : { kind: "query", reads };
      },
      onTablesChanged(listener) {
        tablesListeners.add(listener);
        return () => tablesListeners.delete(listener);
      },
      onReconnected(listener) {
        reconnectListeners.add(listener);
        return () => reconnectListeners.delete(listener);
      },
    },
    answer(entry, run) {
      answers.set(`notes.${entry}`, run);
    },
    changeTables(tables) {
      for (const listener of tablesListeners) listener(tables);
    },
    reconnect() {
      for (const listener of reconnectListeners) listener();
    },
  };
}

/** An answer the test lets arrive when it wants. */
export function held<Value>() {
  let resolve: (value: Value) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<Value>((settleWith, failWith) => {
    resolve = settleWith;
    reject = failWith;
  });
  return { promise, resolve, reject };
}

/** Lets answers arrive and the library's batched updates reach React. */
export async function settle(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

export interface Rendered<State> {
  /** The state of the last render. */
  current(): State;
  /** Shows or hides the hook, as a View that is shown or left. */
  show(visible: boolean): Promise<void>;
}

/** The notices the building block showed, collected instead of reaching the feedback system. */
export type ShownNotices = MessageDescriptor[];

let mounted: { readonly root: Root; readonly container: HTMLElement } | undefined;

/** Renders `useHook` below a `DataProvider` over the fake port, and lets its first answer in. */
export async function renderHook<State>(
  port: FakePort,
  useHook: () => State,
  options: Pick<DataProviderProps, "reportMisuse" | "notify"> = {},
): Promise<Rendered<State>> {
  let state: State | undefined;
  function Probe(): ReactNode {
    state = useHook();
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted = { root, container };
  const draw = (visible: boolean) =>
    createElement(
      DataProvider,
      { access: port.access, ...options },
      visible ? createElement(Probe) : null,
    );
  act(() => root.render(draw(true)));
  await settle();
  return {
    current() {
      if (state === undefined) throw new Error("The hook has not rendered");
      return state;
    },
    async show(visible) {
      act(() => root.render(draw(visible)));
      await settle();
    },
  };
}

/** Unmounts what `renderHook` drew; for `afterEach`. */
export function unmountHook(): void {
  if (mounted === undefined) return;
  const { root, container } = mounted;
  act(() => root.unmount());
  container.remove();
  mounted = undefined;
}
