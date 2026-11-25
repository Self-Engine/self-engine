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
  isDocument,
  isGenerated,
  isTest,
  newPath,
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

describe("isDocument", () => {
  it.each(["docs/adr/0001-a.md", "docs/plan/roadmap.json", "GLOSSARY.md"])(
    "counts %j as a document",
    (path) => {
      expect(isDocument(path)).toBe(true);
    },
  );

  it.each(["AGENTS.md", ".agents/skills/pr-convention/SKILL.md", "packages/docs/src/index.ts"])(
    "counts %j as reviewed",
    (path) => {
      expect(isDocument(path)).toBe(false);
    },
  );

  it("leaves out what CodeRabbit's settings leave out", () => {
    const settings = repoFile(".coderabbit.yaml");
    expect(settings).toContain('- "!docs/**"');
    expect(settings).toContain('- "!GLOSSARY.md"');
  });
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
      file("src/new.ts", 0, 2),
    ]);
  });
});

describe("newPath", () => {
  it.each([
    ["src/a.ts", "src/a.ts"],
    ["docs/research/prior-art.md => scripts/a.ts", "scripts/a.ts"],
    ["{docs => scripts}/a.ts", "scripts/a.ts"],
    ["packages/{time => time-tracking}/src/zone.ts", "packages/time-tracking/src/zone.ts"],
    ["docs/{plan => }/roadmap.json", "docs/roadmap.json"],
    ["src/{ => shell}/a.ts", "src/shell/a.ts"],
  ])("reads %j as %j", (printed, path) => {
    expect(newPath(printed)).toBe(path);
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

  it("counts no line of a pull request that changes documents alone", () => {
    const files = [file("docs/research/prior-art.md", 1400), file("GLOSSARY.md", 30, 4)];
    expect(effectiveLines(files)).toBe(0);
  });

  it("counts a file that moved out of the documents, and none that stays in them", () => {
    const moved = parseNumstat("1000\t0\tdocs/research/prior-art.md => scripts/a.ts\n");
    expect(effectiveLines(moved)).toBe(1000);
    const kept = parseNumstat("40\t2\tdocs/{plan => research}/notes.md\n");
    expect(effectiveLines(kept)).toBe(0);
  });

  it("counts the code beside the documents", () => {
    expect(effectiveLines([file("docs/adr/0041-a.md", 80), file("scripts/a.ts", 12)])).toBe(12);
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
    expect(describeLabel(xs)).toBe(
      "0-9 changed lines, without tests, docs, lockfiles and catalogs.",
    );
    expect(describeLabel(sizeLabel(1000))).toBe(
      "1,000+ changed lines, without tests, docs, lockfiles and catalogs. Needs a review and an app check.",
    );
  });

  it("fits GitHub's limit of 100 characters for every label", () => {
    for (const label of SIZE_LABELS) expect(describeLabel(label).length).toBeLessThanOrEqual(100);
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
      "size:XS\t0e8a16\t0-9 changed lines, without tests, docs, lockfiles and catalogs.",
    );
  });

  it("fails without a base and a head", () => {
    const result = run(["main"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });
});
