import { expect, it } from "vite-plus/test";
import {
  commitWhere,
  countCommit,
  difference,
  type Fiber,
  installRenderCounter,
  renderCounts,
} from "./story-render-counts.ts";

const leaf = (tag: number, flags: number, name: string, sibling: Fiber | null = null): Fiber => ({
  tag,
  flags,
  type: { name },
  child: null,
  sibling,
});

it("counts committed component work and excludes host nodes and memo bailouts", () => {
  const tree: Fiber = {
    ...leaf(3, 0, "Root"),
    child: leaf(0, 1, "View", leaf(0, 0, "Unchanged", leaf(5, 1, "button", leaf(15, 1, "Memo")))),
  };
  const counts = { commits: 0, components: {} };
  const previous = new WeakMap<Fiber, Fiber>();
  countCommit(tree, counts, previous);
  expect(counts).toEqual({ commits: 1, components: { View: 1, Memo: 1 } });
  countCommit(tree, counts, previous);
  expect(counts).toEqual({ commits: 2, components: { View: 1, Memo: 1 } });
});

it("counts work across alternate Fibers but skips an unchanged committed subtree", () => {
  const first: Fiber = { tag: 0, flags: 1, type: { name: "View" }, child: null, sibling: null };
  const second: Fiber = { ...first, alternate: first };
  const counts = { commits: 0, components: {} };
  const previous = new WeakMap<Fiber, Fiber>();
  countCommit(first, counts, previous);
  countCommit(second, counts, previous);
  countCommit(second, counts, previous);
  expect(counts).toEqual({ commits: 3, components: { View: 2 } });
});

it("isolates the work committed between two snapshots", () => {
  const before = { commits: 2, components: { View: 3, Shell: 1 } };
  const after = { commits: 3, components: { View: 5, Shell: 1, Drawer: 1 } };
  expect(difference(after, before)).toEqual({ commits: 1, components: { View: 2, Drawer: 1 } });
});

interface Hook {
  inject(renderer: unknown): number;
  onCommitFiberRoot(id: number, root: { current: Fiber }): void;
}

/** A page as React meets it: the counter installs into `scope`, and React connects on loading. */
function aPageWithReact() {
  const scope = {};
  installRenderCounter(scope);
  const hook = Reflect.get(scope, "__REACT_DEVTOOLS_GLOBAL_HOOK__") as Hook;
  hook.inject({});
  let shown = "";
  const commit = (name: string) => {
    shown = name;
    hook.onCommitFiberRoot(1, { current: leaf(0, 1, name) });
  };
  return { scope, commit, shows: (name: string) => shown === name };
}

it("counts every commit React reports once it has connected", () => {
  const page = aPageWithReact();
  page.commit("List");
  const before = renderCounts(page.scope);
  page.commit("Row");
  expect(difference(renderCounts(page.scope), before)).toEqual({
    commits: 1,
    components: { Row: 1 },
  });
});

it("fails loudly when React loaded before the counter", () => {
  const scope = {};
  installRenderCounter(scope);
  expect(() => renderCounts(scope)).toThrow("React drew without the render counter");
});

it("leaves a hook that is already there in place", () => {
  const existing = {};
  const scope = { __REACT_DEVTOOLS_GLOBAL_HOOK__: existing };
  installRenderCounter(scope);
  expect(scope.__REACT_DEVTOOLS_GLOBAL_HOOK__).toBe(existing);
});

it("waits for the commit that shows something, and not past it", async () => {
  const page = aPageWithReact();
  let done = false;
  const shown = commitWhere(() => page.shows("Row"), page.scope).then(() => {
    done = true;
  });
  page.commit("List");
  await Promise.resolve();
  expect(done).toBe(false);
  page.commit("Row");
  await shown;
  expect(done).toBe(true);
});

it("resolves at once when it is already shown", async () => {
  const page = aPageWithReact();
  page.commit("Row");
  await expect(commitWhere(() => page.shows("Row"), page.scope)).resolves.toBeUndefined();
});
