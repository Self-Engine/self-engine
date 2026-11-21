// @vitest-environment happy-dom
// The timer's hooks end to end without the app (#349): over the real client, building block and
// test Data Process with `projects` and `time-tracking` mounted, and a Clock the test moves. The
// running timers follow each Operation through the Table Change of its commit alone. No fake
// answers: each step waits for the render it expects.

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { createDataConnection, type DataConnection } from "@self-engine/data-client";
import { type DataAccess, DataProvider, portAccessOf } from "@self-engine/data-client/react";
import { startTestDataProcess } from "@self-engine/data-process/testing";
import { createTestSources } from "@self-engine/db/testing";
import { projects } from "@self-engine/projects/data";
import { resolveTimeZone } from "@self-engine/time";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import type { TimerId } from "./contracts/index.ts";
import { timeTracking } from "./data/index.ts";
import {
  useDiscardTimer,
  useRunningTimers,
  useStartTimer,
  useStopTimer,
  useUndoDiscardTimer,
  useUndoStopTimer,
} from "./port.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// The hooks render outside `act`: answers arrive over a real port, at no moment a test can name.
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

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

/** The Data Process's "now" at the start of each test. */
const NOW = "2026-11-16T09:00:00.000Z";

function useTimerHooks() {
  return {
    running: useRunningTimers(),
    start: useStartTimer().run,
    stop: useStopTimer().run,
    discard: useDiscardTimer().run,
    undoStop: useUndoStopTimer().run,
    undoDiscard: useUndoDiscardTimer().run,
  };
}

type Hooks = ReturnType<typeof useTimerHooks>;

/** Draws the timer's hooks over the test Data Process, and the notices of the building block. */
async function renderTimerHooks() {
  const clock = createTestSources(NOW);
  const process = await startTestDataProcess({
    modules: { projects, timeTracking },
    sources: clock,
    deviceZone: resolveTimeZone("Europe/Berlin").timeZone,
  });
  cleanups.push(() => process.close());
  const connection = createDataConnection();
  cleanups.push(() => connection.disconnect());
  connection.connect(process.openPort());
  await untilReady(connection);
  const access = portAccessOf(connection);
  const notices: unknown[] = [];
  const data: DataAccess = {
    access,
    notify: (notice) => notices.push(notice),
    notifyRefused: (notice) => notices.push(notice),
  };

  let hooks: Hooks | undefined;
  const waiting = new Set<() => void>();
  function Reader(): ReactNode {
    hooks = useTimerHooks();
    for (const check of waiting) check();
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  cleanups.push(() => container.remove());
  const root = createRoot(container);
  cleanups.push(() => root.unmount());
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  root.render(
    createElement(I18nProvider, {
      i18n,
      children: createElement(DataProvider, data, createElement(Reader)),
    }),
  );
  const current = () => {
    if (hooks === undefined) throw new Error("The hooks have not rendered");
    return hooks;
  };
  return {
    clock,
    notices,
    current,
    call: (module: string, entry: string, input: unknown) => access.call(module, entry, input),
    /** The running timers' ids and starts, once the Query's answer matches. */
    until(matches: (running: readonly { id: TimerId; startedAt: string }[]) => boolean) {
      return new Promise<readonly { id: TimerId; startedAt: string }[]>((resolve) => {
        const check = () => {
          const state = hooks?.running;
          if (state?.status !== "content") return;
          if (!matches(state.data)) return;
          waiting.delete(check);
          resolve(state.data);
        };
        waiting.add(check);
        check();
      });
    },
  };
}

const none = (running: readonly unknown[]) => running.length === 0;
const one = (running: readonly unknown[]) => running.length === 1;

test("the running timers follow start, stop, undo stop, discard and undo discard through the Table Change alone", async () => {
  const hooks = await renderTimerHooks();
  await hooks.until(none);

  const started = await hooks.current().start({});
  if (started.status !== "success") throw new Error(`start: ${started.status}`);
  const { timer } = started.data;
  const [running] = await hooks.until(one);
  expect(running).toMatchObject({ id: timer.id, startedAt: NOW, project: null });

  hooks.clock.advance(90_000);
  const stopped = await hooks.current().stop({ id: timer.id });
  expect(stopped).toMatchObject({ status: "success", data: { kind: "saved" } });
  await hooks.until(none);

  const undone = await hooks.current().undoStop({ id: timer.id });
  expect(undone).toMatchObject({ status: "success", data: { kind: "restored", others: [] } });
  await expect(hooks.until(one)).resolves.toMatchObject([{ id: timer.id, startedAt: NOW }]);

  await hooks.current().discard({ id: timer.id });
  await hooks.until(none);

  const restored = await hooks.current().undoDiscard({ id: timer.id });
  expect(restored).toMatchObject({ status: "success", data: { kind: "restored" } });
  await expect(hooks.until(one)).resolves.toMatchObject([{ id: timer.id, startedAt: NOW }]);
  expect(hooks.notices).toEqual([]);
});

test("a start that stops the running timer leaves the new one running alone", async () => {
  const hooks = await renderTimerHooks();
  await hooks.until(none);
  const first = await hooks.call("timeTracking", "startTimer", {});
  hooks.clock.advance(60_000);
  const second = await hooks.current().start({});
  if (second.status !== "success") throw new Error(`start: ${second.status}`);
  expect(second.data.others).toMatchObject([{ kind: "saved" }]);
  await expect(hooks.until(one)).resolves.toMatchObject([{ id: second.data.timer.id }]);
  expect(first).toBeDefined();
});
