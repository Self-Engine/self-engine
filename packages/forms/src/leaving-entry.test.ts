// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { type LeavingEntry, useLeavingEntry } from "./leaving-entry.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface Entry {
  readonly title: string;
}

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

/** Renders the hook with `found`; `current` reads its latest answer, `rerender` gives a new `found`. */
function render(found: Entry | undefined) {
  const answers: LeavingEntry<Entry>[] = [];
  function Probe({ found }: { readonly found: Entry | undefined }) {
    answers.push(useLeavingEntry(found));
    return null;
  }
  root = createRoot(document.createElement("div"));
  const rerender = (next: Entry | undefined) =>
    act(() => root?.render(createElement(Probe, { found: next })));
  rerender(found);
  const current = () => {
    const answer = answers.at(-1);
    if (answer === undefined) throw new Error("The hook did not render");
    return answer;
  };
  return { current, rerender };
}

/** A promise and its resolve, to finish an Operation when the test says so. */
function pending() {
  let resolve: (value: boolean) => void = () => {};
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const FIRST = { title: "First" };
const EDITED = { title: "Edited" };

test("follows the entry found and keeps the last one while it is gone", () => {
  const hook = render(FIRST);
  expect(hook.current().entry).toBe(FIRST);
  hook.rerender(EDITED);
  expect(hook.current().entry).toBe(EDITED);
  hook.rerender(undefined);
  expect(hook.current()).toMatchObject({ entry: EDITED, leaving: false });
});

test("keeps the entry as it was while it leaves, and closes on success with the lock held", async () => {
  const hook = render(FIRST);
  const operation = pending();
  let left: Promise<boolean> | undefined;
  act(() => {
    left = hook.current().leave(() => operation.promise);
  });
  expect(hook.current().leaving).toBe(true);
  hook.rerender(EDITED);
  hook.rerender(undefined);
  expect(hook.current().entry).toBe(FIRST);
  await act(async () => operation.resolve(true));
  expect(await left).toBe(true);
  // The drawer is closing: a second activation does nothing.
  let again = true;
  await act(async () => {
    again = await hook.current().leave(async () => true);
  });
  expect(again).toBe(false);
});

test("runs one Operation at a time and releases the lock when it fails", async () => {
  const hook = render(FIRST);
  const operation = pending();
  let calls = 0;
  const run = () => {
    calls += 1;
    return operation.promise;
  };
  let first: Promise<boolean> | undefined;
  let second: Promise<boolean> | undefined;
  act(() => {
    first = hook.current().leave(run);
    second = hook.current().leave(run);
  });
  expect(await second).toBe(false);
  await act(async () => operation.resolve(false));
  expect(await first).toBe(false);
  expect(calls).toBe(1);
  expect(hook.current().leaving).toBe(false);
  hook.rerender(EDITED);
  expect(hook.current().entry).toBe(EDITED);
});

test("asks first when it is to confirm, and leaves nothing when declined", async () => {
  const hook = render(FIRST);
  let ran = false;
  let left = true;
  await act(async () => {
    left = await hook.current().leave(
      async () => {
        ran = true;
        return true;
      },
      async () => false,
    );
  });
  expect({ left, ran, leaving: hook.current().leaving }).toEqual({
    left: false,
    ran: false,
    leaving: false,
  });
});
