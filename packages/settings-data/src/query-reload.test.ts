// @vitest-environment happy-dom
// A Query that reads a Setting and names the Settings table in its reads (D352) reloads when the
// page saves that Setting through the Settings Port: the Table Change of the save's commit alone
// reloads it. The `workday` fixture module reads the Setting; the store saves it as the desktop
// app does. No fake answers and no clock: each step waits for the render it expects.

import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import {
  DataProvider,
  portAccessOf,
  portHooks,
  type QueryState,
} from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import { workday, workdayHours } from "@self-engine/storage/testing";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, test } from "vite-plus/test";
import { createSettingsPortAdapter } from "./adapter/index.ts";
import { settings } from "./data/index.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// The hook renders outside `act`: answers arrive over a real port, at no moment a test can name.
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const useHours = portHooks<typeof workday.contract>("workday").query("hours");

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

function untilReady(connection: DataConnection): Promise<void> {
  return new Promise((resolve) => {
    if (connection.getState().status === "ready") return resolve();
    const unsubscribe = connection.subscribe(() => {
      if (connection.getState().status !== "ready") return;
      unsubscribe();
      resolve();
    });
  });
}

test("a Query that reads a Setting reloads with the value the page saved through the Settings Port", async () => {
  const dataProcess = await startTestDataProcess({ modules: { settings, workday } });
  cleanups.push(() => dataProcess.close());
  const connection = createDataConnection<{ settings: typeof settings.contract }>();
  cleanups.push(() => connection.disconnect());
  connection.connect(dataProcess.openPort());
  await untilReady(connection);
  const store = createSettingsStore({
    adapters: { synced: createSettingsPortAdapter(connection), device: createTestAdapter() },
    onError: (failure) => {
      throw failure.error;
    },
  });
  await store.load();

  let hours: QueryState<number> | undefined;
  const waiting = new Set<() => void>();
  function Probe(): ReactNode {
    hours = useHours(undefined);
    for (const check of waiting) check();
    return null;
  }
  function until(value: number): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (hours?.status !== "content" || hours.data !== value) return;
        waiting.delete(check);
        resolve();
      };
      waiting.add(check);
      check();
    });
  }
  const root = createRoot(document.createElement("div"));
  cleanups.push(() => root.unmount());
  root.render(
    createElement(
      DataProvider,
      {
        access: portAccessOf(connection),
        notify: (notice) => {
          throw new Error(`No notice is expected: ${notice.id}`);
        },
      },
      createElement(Probe),
    ),
  );
  await until(workdayHours.default);

  store.write(workdayHours, 6);

  await until(6);
});
