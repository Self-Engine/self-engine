import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import config from "../vite.config.ts";
import { capture, runStages, STATIC_STAGES, summaryLine, tail, TEST_STAGE } from "./verify.ts";

const rootPackage = fileURLToPath(new URL("../package.json", import.meta.url));

describe("runStages", () => {
  it("runs every static stage even after one fails, and skips the tests", async () => {
    const ran: string[] = [];
    const results = await runStages(async (stage) => {
      ran.push(stage);
      return stage !== "lint";
    });
    expect(ran).toEqual([...STATIC_STAGES]);
    expect(summaryLine(results, "log")).toBe("VERIFY: FAIL lint (full log: log)");
  });

  it("runs the tests once the static stages pass", async () => {
    const results = await runStages(async (stage) => stage !== TEST_STAGE);
    expect(results.map((result) => result.stage)).toEqual([...STATIC_STAGES, TEST_STAGE]);
    expect(summaryLine(results, "log")).toBe("VERIFY: FAIL test (full log: log)");
  });

  it("passes when every stage passes", async () => {
    expect(summaryLine(await runStages(async () => true), "log")).toBe("VERIFY: PASS");
  });
});

describe("the verify tasks", () => {
  it("define one vp task per stage in vite.config.ts", () => {
    const tasks = Object.keys(config.run?.tasks ?? {}).filter((name) => name.startsWith("verify:"));
    expect(tasks.sort()).toEqual(
      [...STATIC_STAGES, TEST_STAGE].map((stage) => `verify:${stage}`).sort(),
    );
  });

  it("let lint warnings fail the gate", () => {
    expect(config.run?.tasks?.["verify:lint"]).toContain("--deny-warnings");
  });

  it("fail the lint stage on a silent catch (packages/oxlint-plugin)", () => {
    expect(config.lint?.rules?.["self-engine/no-silent-catch"]).toBe("error");
  });

  it("load the repo's lint rules from the workspace package", () => {
    expect(config.lint?.jsPlugins).toContainEqual({
      name: "self-engine",
      specifier: "@self-engine/oxlint-plugin",
    });
    expect(createRequire(rootPackage).resolve("@self-engine/oxlint-plugin")).toBe(
      fileURLToPath(new URL("../packages/oxlint-plugin/src/index.ts", import.meta.url)),
    );
  });

  it("check the module boundaries with the repo's dependency-cruiser rules", () => {
    const command = config.run?.tasks?.["verify:boundaries"];
    expect(STATIC_STAGES).toContain("boundaries");
    expect(command).toMatch(/^depcruise apps packages scripts /);
    expect(command).toContain("--config .dependency-cruiser.ts");
  });

  it("typecheck through vp, whose reads the task cache tracks (plain tsc's it does not)", () => {
    expect(config.run?.tasks?.["verify:typecheck"]).toBe("vp check --no-fmt --no-lint");
  });
});

describe("capture", () => {
  it("reports a command that cannot start as a failed stage instead of throwing", async () => {
    const result = await capture("/nonexistent/vp", ["run"], process.cwd());
    expect(result.code).toBe(1);
    expect(result.output).toContain("ENOENT");
  });
});

describe("tail", () => {
  it("keeps the last lines and drops trailing blank ones", () => {
    expect(tail("a\nb\nc\n\n", 2)).toBe("b\nc");
  });
});
