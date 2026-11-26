// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
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
  const onDone = vi.fn();
  function Probe({ found }: { readonly found: Entry | undefined }) {
    answers.push(useLeavingEntry(found, onDone));
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
  return { current, rerender, onDone };
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
  expect(hook.current()).toMatchObject({ entry: EDITED, deleted: true });
  hook.rerender(FIRST);
  expect(hook.current()).toMatchObject({ entry: FIRST, deleted: false });
});

test("keeps the entry as it was while it leaves, and closes on success with the lock held", async () => {
  const hook = render(FIRST);
  const operation = pending();
  let left: Promise<void> | undefined;
  act(() => {
    left = hook.current().leave(() => operation.promise);
  });
  hook.rerender(EDITED);
  hook.rerender(undefined);
  expect(hook.current()).toMatchObject({ entry: FIRST, deleted: false });
  expect(hook.onDone).not.toHaveBeenCalled();
  await act(async () => {
    operation.resolve(true);
    await left;
  });
  expect(hook.onDone).toHaveBeenCalledOnce();
  expect(hook.current()).toMatchObject({ entry: FIRST, deleted: false });
  // The drawer is closing: a second activation does nothing.
  const again = vi.fn(async () => true);
  await act(async () => hook.current().leave(again));
  expect(again).not.toHaveBeenCalled();
});

test("runs one Operation at a time and releases the lock when it fails", async () => {
  const hook = render(FIRST);
  const operation = pending();
  let calls = 0;
  const run = () => {
    calls += 1;
    return operation.promise;
  };
  let first: Promise<void> | undefined;
  act(() => {
    first = hook.current().leave(run);
    void hook.current().leave(run);
  });
  expect(calls).toBe(1);
  hook.rerender(undefined);
  await act(async () => {
    operation.resolve(false);
    await first;
  });
  expect(hook.onDone).not.toHaveBeenCalled();
  expect(hook.current()).toMatchObject({ entry: FIRST, deleted: true });
  // After the failure it follows the entry found again.
  hook.rerender(EDITED);
  expect(hook.current()).toMatchObject({ entry: EDITED, deleted: false });
  await act(async () => hook.current().leave(async () => true));
  expect(hook.onDone).toHaveBeenCalledOnce();
});

test("asks first when it is to confirm, and leaves nothing when declined", async () => {
  const hook = render(FIRST);
  const run = vi.fn(async () => true);
  await act(async () => hook.current().leave(run, async () => false));
  expect(run).not.toHaveBeenCalled();
  expect(hook.onDone).not.toHaveBeenCalled();
});
