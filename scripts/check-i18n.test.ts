import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { type CatalogEntry, checkCatalogs } from "./check-i18n.ts";
import { capture } from "./verify.ts";

const required = ["en", "de"];

function entry(message: string, translation: string, context?: string): CatalogEntry {
  return { message, translation, context };
}

describe("checkCatalogs", () => {
  it("accepts complete catalogs with matching placeholders", () => {
    expect(
      checkCatalogs({
        required,
        catalogs: {
          en: [entry("Hello {name}", "Hello {name}")],
          de: [entry("Hello {name}", "Hallo {name}")],
        },
      }),
    ).toEqual({ errors: [], warnings: [] });
  });

  it("fails on an empty translation in a required language and names language and message", () => {
    const { errors } = checkCatalogs({
      required,
      catalogs: {
        en: [entry("Save", "")],
        de: [entry("Save", "Speichern"), entry("Start", "", "verb: begin tracking")],
      },
    });
    expect(errors).toEqual([
      'en: "Save" is not translated',
      'de: "Start" (verb: begin tracking) is not translated',
    ]);
  });

  it("only warns about a gap in a language that is not required", () => {
    expect(
      checkCatalogs({
        required,
        catalogs: {
          en: [entry("Save", "Save")],
          de: [entry("Save", "Speichern")],
          pl: [entry("Save", "")],
        },
      }),
    ).toEqual({ errors: [], warnings: ['pl: "Save" is not translated'] });
  });

  it("fails when a translation's placeholders differ, in a language that is not required too", () => {
    const { errors } = checkCatalogs({
      required,
      catalogs: {
        en: [entry("Hello {name}", "Hello {name}")],
        de: [entry("Hello {name}", "Hallo {nme}")],
        pl: [entry("{count, plural, one {# project} other {# projects}}", "{n} projekty")],
      },
    });
    expect(errors).toEqual([
      'de: "Hello {name}" has placeholders {nme}, the message has {name}',
      'pl: "{count, plural, one {# project} other {# projects}}" has placeholders {n}, the message has {count}',
    ]);
  });

  it("accepts a translation that keeps the plural's argument with its own cases", () => {
    const message = "{count, plural, one {# day} other {# days}}";
    const { errors } = checkCatalogs({
      required,
      catalogs: {
        de: [entry(message, "{count, plural, one {# Tag} few {# Tage} other {# Tage}}")],
      },
    });
    expect(errors).toEqual([]);
  });

  it("finds placeholders nested inside a plural's cases", () => {
    const message = "{count, plural, one {{name} has # day} other {{name} has # days}}";
    const { errors } = checkCatalogs({
      required,
      catalogs: { de: [entry(message, "{count, plural, one {# Tag} other {# Tage}}")] },
    });
    expect(errors).toEqual([
      `de: "${message}" has placeholders {count}, the message has {count}, {name}`,
    ]);
  });

  it("fails when a translation drops a numbered rich-text tag", () => {
    const { errors } = checkCatalogs({
      required,
      catalogs: { de: [entry("Read the <0>guide</0>", "Lies die Anleitung")] },
    });
    expect(errors).toEqual([
      'de: "Read the <0>guide</0>" has placeholders (none), the message has </0>, <0>',
    ]);
  });

  it("fails when a translation leaves a rich-text tag open", () => {
    const { errors } = checkCatalogs({
      required,
      catalogs: { de: [entry("Read the <0>guide</0>", "Lies die <0>Anleitung")] },
    });
    expect(errors).toEqual([
      'de: "Read the <0>guide</0>" has placeholders <0>, the message has </0>, <0>',
    ]);
  });

  it("fails when a translation drops a self-closing tag", () => {
    const { errors } = checkCatalogs({
      required,
      catalogs: { de: [entry("One<0/>Two", "Eins Zwei")] },
    });
    expect(errors).toEqual(['de: "One<0/>Two" has placeholders (none), the message has <0/>']);
  });

  it("accepts rich-text tags in another order", () => {
    const { errors } = checkCatalogs({
      required,
      catalogs: { de: [entry("<0>a</0> and <1>b</1>", "<1>B</1> und <0>A</0>")] },
    });
    expect(errors).toEqual([]);
  });

  it("fails on a translation that is not valid ICU", () => {
    const message = "{count, plural, one {# day} other {# days}}";
    const { errors } = checkCatalogs({
      required,
      catalogs: { de: [entry(message, "{count, plural, one {# Tag}")] },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`de: "${message}" is not valid ICU: `);
  });

  it("fails on a message that is not valid ICU, even with a valid translation", () => {
    const { errors } = checkCatalogs({
      required,
      catalogs: { de: [entry("Broken {name", "Kaputt")] },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('de: "Broken {name" is not valid ICU: Unexpected message end');
  });
});

// Each run starts Node and Lingui's extraction, about a second alone and far more in a full gate.
describe("the script", { timeout: 30_000 }, () => {
  const script = fileURLToPath(new URL("./check-i18n.ts", import.meta.url));
  const config = fileURLToPath(new URL("./testing/lingui-fixture.config.ts", import.meta.url));
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "check-i18n-"));
    vi.stubEnv("I18N_FIXTURE_ROOT", root);
    mkdirSync(join(root, "locales"));
    mkdirSync(join(root, "src"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  function po(entries: Readonly<Record<string, string>>): string {
    return [
      'msgid ""',
      'msgstr ""',
      '"Content-Type: text/plain; charset=utf-8\\n"',
      "",
      ...Object.entries(entries).flatMap(([message, translation]) => [
        `#: src/a.ts`,
        `msgid "${message}"`,
        `msgstr "${translation}"`,
        "",
      ]),
    ].join("\n");
  }

  function source(...messages: readonly string[]): void {
    const lines = messages.map((message, index) => `export const m${index} = msg\`${message}\`;`);
    writeFileSync(
      join(root, "src/a.ts"),
      ['import { msg } from "@lingui/core/macro";', ...lines, ""].join("\n"),
    );
  }

  function catalogs(entries: Readonly<Record<string, Readonly<Record<string, string>>>>): void {
    for (const [language, messages] of Object.entries(entries)) {
      writeFileSync(join(root, `locales/${language}.po`), po(messages));
    }
  }

  function read(language: string): string {
    return readFileSync(join(root, `locales/${language}.po`), "utf8");
  }

  function run(...args: readonly string[]): ReturnType<typeof capture> {
    return capture(process.execPath, [script, "--config", config, ...args], root);
  }

  const inSync = {
    en: { Save: "Save" },
    de: { Save: "Speichern" },
    pl: { Save: "Zapisz" },
  };

  it("passes on catalogs that match the source, and writes nothing with --check", async () => {
    source("Save");
    catalogs(inSync);
    // A local run first, so the files are exactly what extraction writes.
    expect((await run()).code).toBe(0);
    const before = read("de");
    const { code, output } = await run("--check");
    expect({ code, output }).toMatchObject({ code: 0, output: expect.stringContaining("ok") });
    expect(read("de")).toBe(before);
  });

  it("with --check, fails on a message missing from a catalog and writes nothing", async () => {
    source("Save", "New text");
    catalogs(inSync);
    const before = read("de");
    const { code, output } = await run("--check");
    expect(code).toBe(1);
    expect(output).toContain("pnpm verify");
    expect(read("de")).toBe(before);
  });

  it("with --check, fails on a message orphaned in a catalog", async () => {
    source("Save");
    catalogs({
      en: { Save: "Save", Gone: "Gone" },
      de: { Save: "Speichern", Gone: "Weg" },
      pl: { Save: "Zapisz", Gone: "Znik" },
    });
    const { code } = await run("--check");
    expect(code).toBe(1);
    expect(read("de")).toContain("Gone");
  });

  it("leaves the sample text of a story out of the app's catalogs", async () => {
    const appPatterns = fileURLToPath(
      new URL("../packages/i18n/test/lingui-temp-root.config.ts", import.meta.url),
    );
    const sources = join(root, "packages/sample/src");
    mkdirSync(sources, { recursive: true });
    const macro = (message: string) =>
      `import { msg } from "@lingui/core/macro";\nexport const m = msg\`${message}\`;\n`;
    writeFileSync(join(sources, "shown.tsx"), macro("Shown to users"));
    writeFileSync(join(sources, "shown.stories.tsx"), macro("Sample in a story"));

    await capture(process.execPath, [script, "--config", appPatterns], root);

    expect(read("de")).toContain("Shown to users");
    expect(read("de")).not.toContain("Sample in a story");
  });

  it("with --check, names a message that is not extracted yet, for each language", async () => {
    source("Save", "New text");
    catalogs(inSync);
    const { output } = await run("--check");
    expect(output).toContain('de: "New text" is missing from the catalog');
    expect(output).toContain('pl: "New text" is missing from the catalog');
  });

  it("with --check, names a message that is no longer in the source", async () => {
    source("Save");
    catalogs({ ...inSync, de: { Save: "Speichern", Gone: "Weg" } });
    const { output } = await run("--check");
    expect(output).toContain('de: "Gone" is no longer in the source');
    expect(output).not.toContain('en: "Gone"');
  });

  it("with --check, calls nothing stale when a source file cannot be extracted", async () => {
    writeFileSync(join(root, "src/a.ts"), "export const = ;\n");
    catalogs(inSync);
    const { code, output } = await run("--check");
    expect(code).toBe(1);
    expect(output).not.toContain("is no longer in the source");
  });

  it("with --check, fails instead of crashing on a catalog that does not exist yet", async () => {
    source("Save");
    catalogs({ en: inSync.en, de: inSync.de });
    const { code, output } = await run("--check");
    expect(code).toBe(1);
    expect(output).not.toContain("ENOENT");
  });

  it("run locally, adds a new message and names what is missing", async () => {
    source("Save", "New text");
    catalogs(inSync);
    const { code, output } = await run();
    expect(code).toBe(1);
    expect(read("de")).toContain('msgid "New text"');
    expect(output).toContain('de: "New text" is not translated');
    expect(read("en")).toContain('msgstr "New text"');
  });

  it("run locally, removes an orphaned message and passes", async () => {
    source("Save");
    catalogs({
      en: { Save: "Save", Gone: "Gone" },
      de: { Save: "Speichern", Gone: "Weg" },
      pl: { Save: "Zapisz", Gone: "Znik" },
    });
    const { code } = await run();
    expect(code).toBe(0);
    expect(read("de")).not.toContain("Gone");
  });

  it("reports an empty translation, differing placeholders and invalid ICU by name", async () => {
    source("Save", "Hello {name}", "Three {count}");
    catalogs({
      en: { Save: "Save", "Hello {name}": "Hello {name}", "Three {count}": "Three {count}" },
      de: { Save: "", "Hello {name}": "Hallo {nme}", "Three {count}": "Drei {count" },
      pl: { Save: "Zapisz", "Hello {name}": "Cześć {name}", "Three {count}": "Trzy {count}" },
    });
    const { code, output } = await run("--check");
    expect(code).toBe(1);
    expect(output).toContain('de: "Save" is not translated');
    expect(output).toContain('de: "Hello {name}" has placeholders {nme}, the message has {name}');
    expect(output).toContain('de: "Three {count}" is not valid ICU: ');
  });

  it("only warns about a gap in a language that is not required", async () => {
    source("Save");
    catalogs({ ...inSync, pl: { Save: "" } });
    const { code, output } = await run();
    expect(code).toBe(0);
    expect(output).toContain('warning pl: "Save" is not translated');
  });

  it("fails on a source file that cannot be extracted", async () => {
    writeFileSync(join(root, "src/a.ts"), "export const = ;\n");
    catalogs(inSync);
    expect((await run()).code).toBe(1);
  });
});
