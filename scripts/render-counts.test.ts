import { expect, it } from "vite-plus/test";
import {
  compareReports,
  countCommit,
  difference,
  type Fiber,
  type RenderReport,
} from "./render-counts.ts";

it("counts committed component work and excludes host nodes and memo bailouts", () => {
  const leaf = (tag: number, flags: number, name: string, sibling: Fiber | null = null): Fiber => ({
    tag,
    flags,
    type: { name },
    child: null,
    sibling,
  });
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

it("reports per-scenario deltas between code states without enforcing a threshold", () => {
  const before = { commits: 2, components: { View: 3, Shell: 1 } };
  const after = { commits: 3, components: { View: 5, Shell: 1, Drawer: 1 } };
  expect(difference(after, before)).toEqual({ commits: 1, components: { View: 2, Drawer: 1 } });
  expect(
    compareReports(
      { version: 1, revision: "new", scenarios: { drawer: after } },
      { version: 1, revision: "old", scenarios: { drawer: before } },
    ),
  ).toContain("drawer: 7 component renders, 3 commits (renders +3)");
});

it("rejects incompatible scenario reports", () => {
  expect(() =>
    compareReports(
      { version: 1, revision: "new", scenarios: {} },
      { version: 1, revision: "old", scenarios: { drawer: { commits: 0, components: {} } } },
    ),
  ).toThrow("Incompatible");
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

it("includes components eliminated by the new code state in the comparison", () => {
  const current = {
    version: 1,
    revision: "new",
    scenarios: { drawer: { commits: 1, components: { Drawer: 1 } } },
  } satisfies RenderReport;
  expect(
    compareReports(current, {
      version: 1,
      revision: "old",
      scenarios: { drawer: { commits: 2, components: { Drawer: 2, Shell: 3 } } },
    }),
  ).toContain("Shell: 0 (-3)");
});
