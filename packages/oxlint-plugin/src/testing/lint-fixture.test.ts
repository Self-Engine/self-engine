import { describe, expect, it } from "vite-plus/test";
import { diagnosticsOfFile, lintFixture, lintFixtures } from "./lint-fixture.ts";

describe("lintFixtures", () => {
  it("returns the diagnostics of each fixture in order", () => {
    const [silent, clean, twice] = lintFixtures("no-silent-catch", [
      "try { a(); } catch {}",
      "try { a(); } catch (error) { log(error); }",
      "try { a(); } catch {}\ntry { b(); } catch {}",
    ]);
    expect([silent?.length, clean?.length, twice?.length]).toEqual([1, 0, 2]);
    expect(silent?.[0]).toContain("self-engine(no-silent-catch)");
  });

  it("writes a fixture at the path it names, under the folder", () => {
    const [named, plain] = lintFixtures(
      "no-time-outside-time",
      [{ path: "time/src/clock.ts", source: "Date.now();" }, "Date.now();"],
      "packages",
    );
    expect([named?.length, plain?.length]).toEqual([0, 1]);
  });

  it("refuses two fixtures that share a file name", () => {
    expect(() =>
      lintFixtures("no-silent-catch", [
        { path: "a/same.ts", source: "export {};" },
        { path: "b/same.ts", source: "export {};" },
      ]),
    ).toThrow(/same\.ts/);
  });

  it("fails on a run that did not lint, instead of reporting it clean", () => {
    expect(() => lintFixture("no-such-rule", "export {};")).toThrow(/oxlint exited with/);
  });
});

describe("diagnosticsOfFile", () => {
  const lines = [
    "fixture-1.ts:1:14: a bare name, as on Linux [Error/rule]",
    "/var/folders/T/x/fixture-1.ts:2:3: an absolute path, as on macOS [Error/rule]",
    "fixture-11.ts:1:14: another file [Error/rule]",
  ];

  it("finds a file's lines whatever path shape Oxlint printed", () => {
    expect(diagnosticsOfFile(lines, "fixture-1.ts")).toEqual(lines.slice(0, 2));
  });

  it("does not confuse files whose names share a prefix", () => {
    expect(diagnosticsOfFile(lines, "fixture-11.ts")).toEqual([lines[2]]);
  });
});
