import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import config from "../vite.config.ts";
import {
  capture,
  isCi,
  runStages,
  stageTask,
  STATIC_STAGES,
  summaryLine,
  tail,
  TEST_STAGES,
} from "./verify.ts";

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

  it("runs the tests once the static stages pass, and skips the stories when they fail", async () => {
    const results = await runStages(async (stage) => stage !== "test");
    expect(results.map((result) => result.stage)).toEqual([...STATIC_STAGES, "test"]);
    expect(summaryLine(results, "log")).toBe("VERIFY: FAIL test (full log: log)");
  });

  it("runs the stories last, and names them when they fail", async () => {
    const results = await runStages(async (stage) => stage !== "stories");
    expect(results.map((result) => result.stage)).toEqual([...STATIC_STAGES, "test", "stories"]);
    expect(summaryLine(results, "log")).toBe("VERIFY: FAIL stories (full log: log)");
  });

  it("passes when every stage passes", async () => {
    expect(summaryLine(await runStages(async () => true), "log")).toBe("VERIFY: PASS");
  });
});

describe("the verify tasks", () => {
  it("define every task the stages run, locally and in CI, and no others", () => {
    const tasks = Object.keys(config.run?.tasks ?? {}).filter((name) => name.startsWith("verify:"));
    const stages = [...STATIC_STAGES, ...TEST_STAGES];
    const used = new Set(
      [{}, { CI: "true" }].flatMap((env) => stages.map((stage) => stageTask(stage, env))),
    );
    expect(tasks.sort()).toEqual([...used].sort());
  });

  it("rewrite the format locally and only check it in CI", () => {
    expect(config.run?.tasks?.["verify:format"]).toBe("vp fmt");
    expect(config.run?.tasks?.["verify:format:check"]).toBe("vp fmt --check");
  });

  it("run the theme CSS check as a static stage", () => {
    expect(STATIC_STAGES).toContain("theme-css");
    expect(config.run?.tasks?.["verify:theme-css"]).toBe("node scripts/check-theme-css.ts");
  });

  it("extract the catalogs locally and only check them in CI", () => {
    expect(config.run?.tasks?.["verify:i18n"]).toBe("node scripts/check-i18n.ts");
    expect(config.run?.tasks?.["verify:i18n:check"]).toBe("node scripts/check-i18n.ts --check");
  });

  it("check the translations before the build", () => {
    expect(STATIC_STAGES.indexOf("i18n")).toBeGreaterThanOrEqual(0);
    expect(STATIC_STAGES.indexOf("i18n")).toBeLessThan(STATIC_STAGES.indexOf("build"));
  });

  it("let lint warnings fail the gate", () => {
    expect(config.run?.tasks?.["verify:lint"]).toContain("--deny-warnings");
  });

  it("fail the lint stage on a silent catch (packages/oxlint-plugin)", () => {
    expect(config.lint?.rules?.["self-engine/no-silent-catch"]).toBe("error");
  });

  it("fail the lint stage on an import type query, which the boundary check cannot see", () => {
    expect(config.lint?.rules?.["self-engine/no-import-type-query"]).toBe("error");
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

  it("build the workspace, which catches what only the bundlers see", () => {
    expect(STATIC_STAGES).toContain("build");
    expect(config.run?.tasks?.["verify:build"]).toBe("vp run --cache -r build");
  });

  it("typecheck through vp, whose reads the task cache tracks (plain tsc's it does not)", () => {
    expect(config.run?.tasks?.["verify:typecheck"]).toBe("vp check --no-fmt --no-lint");
  });

  it("render the stories with the catalog's own config, so the Node tests need no browser", () => {
    expect(config.run?.tasks?.["verify:stories"]).toMatchObject({
      command: "vp test run --root apps/component-catalog --reporter=agent",
    });
    expect(config.test?.browser).toBeUndefined();
    expect(config.test?.include?.join()).not.toContain("stories");
  });

  it("ensure Chromium before the stories, on every run even when the stories replay", () => {
    expect(config.run?.tasks?.["verify:stories"]).toMatchObject({
      dependsOn: ["ensure-chromium"],
    });
    expect(config.run?.tasks?.["ensure-chromium"]).toEqual({
      command: "node scripts/ensure-chromium.ts",
      cache: false,
    });
  });
});

describe("stageTask", () => {
  it("runs every stage as verify:<stage> outside CI", () => {
    for (const stage of [...STATIC_STAGES, ...TEST_STAGES]) {
      expect(stageTask(stage, {})).toBe(`verify:${stage}`);
    }
  });

  it("checks format and catalogs instead of rewriting them in CI, and leaves the others", () => {
    expect(stageTask("format", { CI: "true" })).toBe("verify:format:check");
    expect(stageTask("i18n", { CI: "true" })).toBe("verify:i18n:check");
    expect(stageTask("lint", { CI: "true" })).toBe("verify:lint");
    expect(stageTask("test", { CI: "true" })).toBe("verify:test");
    expect(stageTask("stories", { CI: "true" })).toBe("verify:stories");
  });
});

describe("isCi", () => {
  it("treats CI set to a value as CI", () => {
    expect(isCi({ CI: "true" })).toBe(true);
    expect(isCi({ CI: "1" })).toBe(true);
    expect(isCi({ CI: "TRUE" })).toBe(true);
  });

  it("treats CI unset, empty, false or 0 as a local run", () => {
    expect(isCi({})).toBe(false);
    expect(isCi({ CI: "" })).toBe(false);
    expect(isCi({ CI: "false" })).toBe(false);
    expect(isCi({ CI: "0" })).toBe(false);
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
