// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { LazyContribution, lazyComponents, type LoadComponent } from "./lazy-contribution.tsx";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface Props {
  readonly label: string;
}

const Older = ({ label }: Props) => <p>Older: {label}</p>;
const Newer = ({ label }: Props) => <p>Newer: {label}</p>;

/** Code that arrives when the test says so. */
function code() {
  let arrive!: (component: typeof Older) => void;
  let fail!: (error: Error) => void;
  const pending = new Promise<{ readonly default: typeof Older }>((resolve, reject) => {
    arrive = (component) => resolve({ default: component });
    fail = reject;
  });
  return { pending, arrive, fail };
}

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

test("a load forgotten meanwhile does not replace what the newer load brought", async () => {
  const older = code();
  const newer = code();
  const load = vi
    .fn<LoadComponent<Props>>()
    .mockReturnValueOnce(older.pending)
    .mockReturnValueOnce(newer.pending);
  const components = lazyComponents<Props>();
  const first = components.load(load);
  components.forget(load);
  const second = components.load(load);
  newer.arrive(Newer);
  await second;
  older.arrive(Older);
  // Its own callers still hear what it brought.
  expect(await first).toBe(Older);
  expect(components.loaded(load)).toBe(Newer);
  expect(await components.load(load)).toBe(Newer);
  expect(load).toHaveBeenCalledTimes(2);
});

test("a failed load forgotten meanwhile leaves the newer load in place", async () => {
  const older = code();
  const newer = code();
  const load = vi
    .fn<LoadComponent<Props>>()
    .mockReturnValueOnce(older.pending)
    .mockReturnValue(newer.pending);
  const components = lazyComponents<Props>();
  const first = components.load(load);
  components.forget(load);
  const second = components.load(load);
  older.fail(new Error("the older load failed"));
  await expect(first).rejects.toThrow("the older load failed");
  expect(components.load(load)).toBe(second);
  expect(load).toHaveBeenCalledTimes(2);
  newer.arrive(Newer);
  expect(await second).toBe(Newer);
});

test("a failed load is not kept, so the next one loads anew", async () => {
  const failing = code();
  const working = code();
  const load = vi
    .fn<LoadComponent<Props>>()
    .mockReturnValueOnce(failing.pending)
    .mockReturnValueOnce(working.pending);
  const components = lazyComponents<Props>();
  const first = components.load(load);
  failing.fail(new Error("offline"));
  await expect(first).rejects.toThrow("offline");
  working.arrive(Newer);
  expect(await components.load(load)).toBe(Newer);
});

test("code that arrived for other `components` is not shown for new ones with the same load", async () => {
  const older = code();
  const newer = code();
  const load = vi
    .fn<LoadComponent<Props>>()
    .mockReturnValueOnce(older.pending)
    .mockReturnValueOnce(newer.pending);
  const before = lazyComponents<Props>();
  const after = lazyComponents<Props>();
  const target = document.createElement("div");
  root = createRoot(target);
  const draw = (components: typeof before, label: string) =>
    act(async () =>
      root?.render(
        <LazyContribution
          components={components}
          fallback="loading"
          load={load}
          props={{ label }}
        />,
      ),
    );
  await draw(before, "first");
  // The older code arrives in the update that also brings the new `components`.
  await act(async () => {
    older.arrive(Older);
    await before.load(load);
    root?.render(
      <LazyContribution
        components={after}
        fallback="loading"
        load={load}
        props={{ label: "second" }}
      />,
    );
  });
  expect(target.textContent).toBe("loading");
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => {
    newer.arrive(Newer);
    await after.load(load);
  });
  expect(target.textContent).toBe("Newer: second");
});
