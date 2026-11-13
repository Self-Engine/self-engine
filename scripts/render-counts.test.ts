import { expect, it } from "vite-plus/test";
import { compareReports, type RenderReport } from "./render-counts.ts";

it("reports per-scenario deltas between code states without enforcing a threshold", () => {
  const before = { commits: 2, components: { View: 3, Shell: 1 } };
  const after = { commits: 3, components: { View: 5, Shell: 1, Drawer: 1 } };
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
