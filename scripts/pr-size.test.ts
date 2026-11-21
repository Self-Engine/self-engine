import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  type ChangedFile,
  REVIEW_LABEL,
  SIZE_LABELS,
  describeLabel,
  effectiveLines,
  isGenerated,
  isTest,
  parseNumstat,
  sizeLabel,
} from "./pr-size.ts";

const script = fileURLToPath(new URL("./pr-size.ts", import.meta.url));
const repoFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function file(path: string, additions: number, deletions = 0): ChangedFile {
  return { path, additions, deletions };
}

describe("isGenerated", () => {
  it.each([
    "pnpm-lock.yaml",
    "prototypes/layer-0-spikes/pnpm-lock.yaml",
    "prototypes/data-model/bun.lock",
    "packages/i18n/src/locales/de.po",
  ])("counts %j as generated", (path) => {
    expect(isGenerated(path)).toBe(true);
  });

  it.each(["packages/time/src/zone.ts", "packages/i18n/test/fixtures/de.po", "my-pnpm-lock.yaml"])(
    "counts %j as written by hand",
    (path) => {
      expect(isGenerated(path)).toBe(false);
    },
  );
});

describe("isTest", () => {
  it.each([
    "scripts/pr-size.test.ts",
    "apps/web/src/shell.spec.tsx",
    "packages/i18n/test/fixtures/de.po",
    "packages/ui/src/__tests__/button.tsx",
    "scripts/testing/git.ts",
  ])("counts %j as a test", (path) => {
    expect(isTest(path)).toBe(true);
  });

  it.each(["scripts/pr-size.ts", "packages/time/src/latest.ts", "docs/testing.md"])(
    "counts %j as code",
    (path) => {
      expect(isTest(path)).toBe(false);
    },
  );
});

describe("parseNumstat", () => {
  it("reads additions, deletions and the path, and counts a binary file as no lines", () => {
    const text = "3\t1\tsrc/a.ts\n-\t-\tdocs/shot.png\n\n0\t2\tsrc/{old => new}.ts\n";
    expect(parseNumstat(text)).toEqual([
      file("src/a.ts", 3, 1),
      file("docs/shot.png", 0),
      file("src/{old => new}.ts", 0, 2),
    ]);
  });
});

describe("effectiveLines", () => {
  it("counts code, without tests and generated files", () => {
    const files = [file("a.ts", 10, 5), file("a.test.ts", 400), file("pnpm-lock.yaml", 900)];
    expect(effectiveLines(files)).toBe(15);
  });

  it("counts the tests when only tests changed", () => {
    expect(effectiveLines([file("a.test.ts", 40, 2), file("pnpm-lock.yaml", 9)])).toBe(42);
  });
});

describe("sizeLabel", () => {
  it.each([
    [0, "size:XS"],
    [9, "size:XS"],
    [10, "size:S"],
    [99, "size:M"],
    [100, "size:L"],
    [999, "size:XL"],
    [1000, "size:XXL"],
    [50_000, "size:XXL"],
  ])("labels %i lines %s", (lines, name) => {
    expect(sizeLabel(lines).name).toBe(name);
  });
});

describe("describeLabel", () => {
  it("names the range, and for the review label what it needs", () => {
    const [xs] = SIZE_LABELS;
    if (xs === undefined) throw new Error("no labels");
    expect(describeLabel(xs)).toBe("0-9 changed lines, without tests, lockfiles and catalogs.");
    expect(describeLabel(sizeLabel(1000))).toBe(
      "1,000+ changed lines, without tests, lockfiles and catalogs. Needs a CodeRabbit review and an app check.",
    );
  });
});

describe("the size labels in the docs", () => {
  it("are listed in triage-labels.md", () => {
    const doc = repoFile("docs/agents/triage-labels.md");
    for (const label of SIZE_LABELS) expect(doc).toContain(`\`${label.name}\``);
  });

  it("name the review label in the workflow and CodeRabbit's settings", () => {
    expect(repoFile("docs/agents/workflow.md")).toContain(`\`${REVIEW_LABEL}\``);
    expect(repoFile(".coderabbit.yaml")).toContain(`- "${REVIEW_LABEL}"`);
  });
});

describe("the pr-size command", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function git(...args: string[]): string {
    if (dir === undefined) throw new Error("no repository");
    return execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: dir, encoding: "utf8" },
    ).trim();
  }

  function run(args: readonly string[], output?: string) {
    const { GITHUB_OUTPUT: _output, ...rest } = process.env;
    return spawnSync(process.execPath, [script, ...args], {
      cwd: dir,
      env: output === undefined ? rest : { ...rest, GITHUB_OUTPUT: output },
      encoding: "utf8",
    });
  }

  it("labels the lines a branch changes, ignoring whitespace and tests", () => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "pr-size-")));
    git("init", "-q", "-b", "main");
    writeFileSync(join(dir, "a.ts"), "const a = 1;\n");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD");
    const code = Array.from({ length: 120 }, (_, index) => `const v${index} = ${index};`);
    writeFileSync(join(dir, "a.ts"), `  const a = 1;\n${code.join("\n")}\n`);
    writeFileSync(join(dir, "a.test.ts"), "test\n".repeat(2000));
    git("add", ".");
    git("commit", "-q", "-m", "head");
    const output = join(dir, "output");
    writeFileSync(output, "");

    const result = run([base, "HEAD"], output);

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("120 changed lines");
    expect(readFileSync(output, "utf8")).toBe("label=size:L\n");
  });

  it("prints every label with its color and description", () => {
    const result = run(["labels"]);
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toHaveLength(SIZE_LABELS.length);
    expect(lines[0]).toBe(
      "size:XS\t0e8a16\t0-9 changed lines, without tests, lockfiles and catalogs.",
    );
  });

  it("fails without a base and a head", () => {
    const result = run(["main"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });
});
