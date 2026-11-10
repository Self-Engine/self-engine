import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { options, readBaseline } from "./measure-renders.ts";

it("takes an output and a prior code-state report without making comparison a gate", () => {
  expect(options(["--output", ".temp/after.json", "--compare", ".temp/before.json"])).toEqual({
    output: ".temp/after.json",
    compare: ".temp/before.json",
  });
  expect(options([]).output).toBe(".temp/renders/current.json");
  expect(() => options(["--unknown"])).toThrow();
});

it("loads a validated baseline before measurements and rejects unusable input", () => {
  const root = mkdtempSync(join(tmpdir(), "render-baseline-"));
  const path = join(root, "baseline.json");
  const report = {
    version: 1,
    revision: "before",
    scenarios: {
      "change-view": { commits: 2, components: { Shell: 3 } },
      "open-edit-drawer": { commits: 1, components: { Drawer: 1 } },
    },
  };
  try {
    expect(() => readBaseline(path)).toThrow();
    writeFileSync(path, "not json");
    expect(() => readBaseline(path)).toThrow();
    for (const invalid of [
      null,
      [],
      {},
      { ...report, version: 2 },
      { ...report, scenarios: null },
      { ...report, scenarios: [] },
      { ...report, scenarios: {} },
      { ...report, scenarios: { "change-view": { commits: -1, components: {} } } },
      { ...report, scenarios: { "change-view": { commits: 1, components: { Shell: "3" } } } },
      { ...report, scenarios: { "change-view": { commits: 1, components: null } } },
    ]) {
      writeFileSync(path, JSON.stringify(invalid));
      expect(() => readBaseline(path)).toThrow(/render report/);
    }
    writeFileSync(path, JSON.stringify(report));
    expect(readBaseline(path)).toEqual(report);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
