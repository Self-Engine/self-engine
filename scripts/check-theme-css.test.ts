import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { collectThemeVariables, findThemeCssProblems, themeVariables } from "./check-theme-css.ts";
import { capture } from "./verify.ts";

const KNOWN = new Set(["--se-text", "--se-text-muted"]);

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "check-theme-css-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function problems(): string[] {
  return findThemeCssProblems(root, KNOWN);
}

describe("findThemeCssProblems", () => {
  it("reports a hex color with its file and line", () => {
    write("apps/web/src/a.css", ".a {\n  margin: 0;\n  color: #fff;\n}\n");
    expect(problems()).toEqual(['apps/web/src/a.css:3: color literal "#fff": use a Color Role']);
  });

  it("reports every color function the spec names, in any case", () => {
    write(
      "packages/time/src/b.module.css",
      [
        ".b {",
        "  color: rgb(0 0 0);",
        "  background: rgba(0, 0, 0, 0.5);",
        "  border-color: hsl(10 20% 30%);",
        "  outline-color: HSLA(10, 20%, 30%, 1);",
        "  fill: oklch(0.5 0.1 200);",
        "}",
      ].join("\n"),
    );
    expect(problems()).toEqual([
      'packages/time/src/b.module.css:2: color literal "rgb(": use a Color Role',
      'packages/time/src/b.module.css:3: color literal "rgba(": use a Color Role',
      'packages/time/src/b.module.css:4: color literal "hsl(": use a Color Role',
      'packages/time/src/b.module.css:5: color literal "HSLA(": use a Color Role',
      'packages/time/src/b.module.css:6: color literal "oklch(": use a Color Role',
    ]);
  });

  it("reports a --se-* name the theme package does not define", () => {
    write("apps/web/src/c.css", ".c {\n  color: var(--se-text-mutd);\n}\n");
    expect(problems()).toEqual([
      'apps/web/src/c.css:2: unknown theme variable "--se-text-mutd": not defined by @self-engine/theme',
    ]);
  });

  it("accepts the --se-* names the theme package defines", () => {
    write(
      "apps/web/src/c.css",
      ".c {\n  color: var(--se-text);\n  fill: var(--se-text-muted);\n}\n",
    );
    expect(problems()).toEqual([]);
  });

  it("reports any use of a --mantine-color-* variable", () => {
    write("apps/web/src/d.css", ".d {\n\n  color: var(--mantine-color-blue-6);\n}\n");
    expect(problems()).toEqual([
      'apps/web/src/d.css:3: Mantine palette variable "--mantine-color-blue-6": use a Color Role',
    ]);
  });

  it("leaves other Mantine variables and look-alike names alone", () => {
    write(
      "apps/web/src/e.css",
      ".e {\n  padding: var(--mantine-spacing-md);\n  color: var(--app--se-thing);\n}\n",
    );
    expect(problems()).toEqual([]);
  });

  it("reports the violations of one file in source order", () => {
    write(
      "apps/web/src/f.css",
      ".f {\n  color: var(--mantine-color-red-1);\n  fill: #000;\n  stroke: var(--se-nope);\n}\n",
    );
    expect(problems().map((problem) => problem.split(": ")[0])).toEqual([
      "apps/web/src/f.css:2",
      "apps/web/src/f.css:3",
      "apps/web/src/f.css:4",
    ]);
  });

  it.each(["transparent", "currentColor", "currentcolor", "inherit"])("allows %s", (keyword) => {
    write("apps/web/src/g.css", `.g {\n  color: ${keyword};\n}\n`);
    expect(problems()).toEqual([]);
  });

  it("does not read an id selector as a hex color", () => {
    write(
      "apps/web/src/h.css",
      "#fff, #add .x {\n  margin: 0;\n}\n.y {\n  #abc & {\n    margin: 0;\n  }\n}\n",
    );
    expect(problems()).toEqual([]);
  });

  it("does not report a color in a feature query", () => {
    write(
      "apps/web/src/i.css",
      "@supports (color: oklch(0 0 0)) {\n  .i {\n    margin: 0;\n  }\n}\n",
    );
    expect(problems()).toEqual([]);
  });

  it("ignores comments, strings and urls, and keeps the line count right after them", () => {
    write(
      "apps/web/src/j.css",
      [
        "/* #fff rgb(0 0 0)",
        "   var(--se-nope) var(--mantine-color-red-1) */",
        ".j {",
        '  content: "#fff var(--se-nope)";',
        "  background: url(icons.svg#abc);",
        "  mask: url('a.svg#def');",
        "  color: #123456;",
        "}",
      ].join("\n"),
    );
    expect(problems()).toEqual(['apps/web/src/j.css:7: color literal "#123456": use a Color Role']);
  });

  it("reports the last declaration of a block, which has no semicolon", () => {
    write("apps/web/src/k.css", ".k { color: #abcdef }\n");
    expect(problems()).toEqual(['apps/web/src/k.css:1: color literal "#abcdef": use a Color Role']);
  });

  it("skips the theme package and prototypes", () => {
    write("packages/theme/src/fonts.css", ".a {\n  color: #fff;\n}\n");
    write("prototypes/layer-1-shell/src/global.css", ".a {\n  color: #fff;\n}\n");
    expect(problems()).toEqual([]);
  });

  it("still scans a package whose name only starts with theme", () => {
    write("packages/theme-tools/src/a.css", ".a {\n  color: #fff;\n}\n");
    expect(problems()).toEqual([
      'packages/theme-tools/src/a.css:2: color literal "#fff": use a Color Role',
    ]);
  });

  it.each([
    "apps/web/node_modules/x/a.css",
    "apps/web/dist/a.css",
    "apps/desktop/dist-electron/a.css",
    "apps/desktop/dist-release/a.css",
    "apps/desktop/release/a.css",
    "packages/time/.cache/a.css",
  ])("skips generated output in %s", (path) => {
    write(path, ".a {\n  color: #fff;\n}\n");
    expect(problems()).toEqual([]);
  });

  it("reads only CSS files", () => {
    write("apps/web/src/a.tsx", 'export const color = "#fff";\n');
    expect(problems()).toEqual([]);
  });
});

describe("collectThemeVariables", () => {
  it("finds --se-* names in keys and values at any depth, and ignores functions", () => {
    const names = collectThemeVariables({
      LIST: ["--se-from-list"],
      DENSITY: { compact: { "--se-from-key": "2px" } },
      CSS: ".a { --se-from-text: 0; }",
      named: () => "--se-from-function",
      NUMBER: 1,
    });
    expect([...names].sort()).toEqual(["--se-from-key", "--se-from-list", "--se-from-text"]);
  });

  it("survives an object that refers to itself", () => {
    const loop: Record<string, unknown> = { name: "--se-loop" };
    loop.self = loop;
    expect([...collectThemeVariables(loop)]).toEqual(["--se-loop"]);
  });
});

describe("themeVariables", () => {
  it("knows the Color Roles of the real theme package", () => {
    const names = themeVariables();
    for (const name of ["--se-text-muted", "--se-nav-surface", "--se-on-accent", "--se-hover"]) {
      expect(names).toContain(name);
    }
  });
});

describe("the script", () => {
  const script = fileURLToPath(new URL("./check-theme-css.ts", import.meta.url));

  it("fails and names the file and line of each kind of violation", async () => {
    write(
      "apps/web/src/a.css",
      ".a {\n  color: #fff;\n  fill: var(--se-nope);\n  stroke: var(--mantine-color-red-1);\n}\n",
    );
    const { code, output } = await capture(process.execPath, [script, root], root);
    expect(code).toBe(1);
    expect(output).toContain("apps/web/src/a.css:2:");
    expect(output).toContain("apps/web/src/a.css:3:");
    expect(output).toContain("apps/web/src/a.css:4:");
  });

  it("passes on clean CSS", async () => {
    write("apps/web/src/a.css", ".a {\n  color: var(--se-text);\n}\n");
    const { code } = await capture(process.execPath, [script, root], root);
    expect(code).toBe(0);
  });
});
