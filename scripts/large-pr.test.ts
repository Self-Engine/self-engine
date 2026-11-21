import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  type ChangedFile,
  LARGE_PR_LINES,
  changedLines,
  isGenerated,
  isLarge,
  parseChangedFiles,
} from "./large-pr.ts";

const script = fileURLToPath(new URL("./large-pr.ts", import.meta.url));
const workflow = fileURLToPath(new URL("../docs/agents/workflow.md", import.meta.url));

function file(filename: string, additions: number, deletions = 0): ChangedFile {
  return { filename, additions, deletions };
}

describe("isGenerated", () => {
  it.each([
    "pnpm-lock.yaml",
    "prototypes/layer-0-spikes/pnpm-lock.yaml",
    "prototypes/data-model/bun.lock",
    "packages/i18n/src/locales/de.po",
    "packages/i18n/src/locales/en.po",
  ])("counts %j as generated", (path) => {
    expect(isGenerated(path)).toBe(true);
  });

  it.each([
    "packages/time/src/zone.ts",
    "packages/i18n/test/fixtures/de.po",
    "docs/agents/workflow.md",
    "my-pnpm-lock.yaml",
  ])("counts %j as written by hand", (path) => {
    expect(isGenerated(path)).toBe(false);
  });
});

describe("changedLines", () => {
  it("adds additions and deletions and leaves out generated files", () => {
    const files = [file("a.ts", 10, 5), file("pnpm-lock.yaml", 900), file("b.md", 1, 2)];
    expect(changedLines(files)).toBe(18);
  });
});

describe("isLarge", () => {
  it("is large from the limit on", () => {
    expect(isLarge([file("a.ts", LARGE_PR_LINES - 1)])).toBe(false);
    expect(isLarge([file("a.ts", LARGE_PR_LINES - 1, 1)])).toBe(true);
  });

  it("stays small when only generated files grow", () => {
    expect(isLarge([file("a.ts", 10), file("packages/i18n/src/locales/de.po", 5000)])).toBe(false);
  });

  it("matches the limit the workflow names", () => {
    expect(readFileSync(workflow, "utf8")).toContain(`${LARGE_PR_LINES.toLocaleString("en")} `);
  });
});

describe("parseChangedFiles", () => {
  it("reads one file per line and skips empty lines", () => {
    const text = `{"filename":"a.ts","additions":3,"deletions":1}\n\n{"filename":"b.ts","additions":0,"deletions":2}\n`;
    expect(parseChangedFiles(text)).toEqual([file("a.ts", 3, 1), file("b.ts", 0, 2)]);
  });

  it("names a line that is no changed file", () => {
    expect(() => parseChangedFiles(`{"filename":"a.ts","additions":"3"}`)).toThrow(
      "Line 1 is no changed file",
    );
  });
});

describe("the large-pr command", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function run(lines: readonly ChangedFile[] | undefined) {
    dir = mkdtempSync(join(tmpdir(), "large-pr-"));
    const output = join(dir, "output");
    writeFileSync(output, "");
    const env: Record<string, string> = { GITHUB_OUTPUT: output };
    if (lines !== undefined) {
      const files = join(dir, "files.jsonl");
      writeFileSync(files, lines.map((line) => JSON.stringify(line)).join("\n"));
      env.PR_FILES = files;
    }
    const { PR_FILES: _files, GITHUB_OUTPUT: _output, ...rest } = process.env;
    const result = spawnSync(process.execPath, [script], {
      env: { ...rest, ...env },
      encoding: "utf8",
    });
    return { ...result, output: readFileSync(output, "utf8") };
  }

  it("writes large=true for a large pull request", () => {
    const result = run([file("a.ts", 800), file("b.ts", 200)]);
    expect(result.status).toBe(0);
    expect(result.output).toBe("large=true\n");
    expect(result.stdout).toContain("1000 changed lines");
  });

  it("writes large=false for a small one", () => {
    const result = run([file("a.ts", 12)]);
    expect(result.status).toBe(0);
    expect(result.output).toBe("large=false\n");
  });

  it("fails when PR_FILES is missing", () => {
    const result = run(undefined);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PR_FILES is not set");
  });
});
