import { describe, expect, it } from "vite-plus/test";
import { lintFixture, lintFixtures } from "./lint-fixture.ts";

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

  it("fails on a run that did not lint, instead of reporting it clean", () => {
    expect(() => lintFixture("no-such-rule", "export {};")).toThrow(/oxlint exited with/);
  });
});
