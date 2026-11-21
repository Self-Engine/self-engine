import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";
import {
  inspectStartup,
  type LazyOnlyDependency,
  startupBundle,
  type StartupChunk,
  type StartupRules,
} from "../startup-bundle.ts";
import { STARTUP_RULES } from "../startup-rules.ts";

/** The startup rules alone: the chunks of these tests hold none of the Views of the on-demand rules. */
const LAZY_ONLY_RULES: StartupRules = { maxBytes: 100, lazyOnly: STARTUP_RULES.lazyOnly };

function chunk(fileName: string, options: Partial<StartupChunk> = {}): StartupChunk {
  return { fileName, isEntry: false, imports: [], code: "abc", modules: {}, ...options };
}

it("counts shared startup chunks once, using bytes, and ignores deferred Views", () => {
  expect(
    inspectStartup(
      [
        chunk("main.js", { isEntry: true, imports: ["shared.js", "other.js"] }),
        chunk("other.js", { imports: ["shared.js"] }),
        chunk("shared.js", { code: "ä" }),
        chunk("view.js", { code: "too big", modules: { "/view.tsx": {} } }),
      ],
      new Set(["/view.tsx"]),
      { maxBytes: 8 },
    ),
  ).toEqual({
    bytes: 8,
    maxBytes: 8,
    chunks: ["main.js", "other.js", "shared.js"],
    eagerLazyModules: [],
    problems: [],
  });
});

it("rejects a View entering a shared startup chunk even below the size limit", () => {
  const result = inspectStartup(
    [
      chunk("main.js", { isEntry: true, imports: ["shared.js"] }),
      chunk("shared.js", { modules: { "/view.tsx": {} } }),
    ],
    new Set(["/view.tsx"]),
    { maxBytes: 100 },
  );
  expect(result.problems).toEqual(["Lazy module entered the startup bundle: /view.tsx"]);
});

const HEAVY: LazyOnlyDependency = {
  name: "The heavy build",
  path: "/node_modules/heavy/full/",
  instead: "use its light build.",
};

/** `heavy` as a package: its entry re-exports the full build, which shares a core with the light one. */
const HEAVY_IMPORTERS: Readonly<Record<string, readonly string[]>> = {
  "/node_modules/heavy/full/schemas.js": ["/node_modules/heavy/index.js"],
  "/node_modules/heavy/index.js": ["/app/settings.ts", "/app/shell.ts", "/app/command.ts"],
  "/node_modules/heavy/core/parse.js": [
    "/node_modules/heavy/full/schemas.js",
    "/node_modules/heavy/light/schemas.js",
  ],
};
const heavyImporters = (id: string) => HEAVY_IMPORTERS[id] ?? [];

it("rejects a lazy-only dependency in a startup chunk and names the startup code that imports it", () => {
  const result = inspectStartup(
    [
      chunk("main.js", {
        isEntry: true,
        imports: ["vendor.js"],
        modules: { "/app/shell.ts": {}, "/app/settings.ts": {} },
      }),
      chunk("vendor.js", {
        modules: {
          "/node_modules/heavy/full/schemas.js": {},
          "/node_modules/heavy/core/parse.js": {},
        },
      }),
      chunk("command.js", { modules: { "/app/command.ts": {} } }),
    ],
    new Set(),
    { maxBytes: 100, lazyOnly: [HEAVY] },
    heavyImporters,
  );
  expect(result.problems).toEqual([
    "The heavy build entered the startup bundle, imported by /app/settings.ts, /app/shell.ts: use its light build.",
  ]);
});

it("accepts a lazy-only dependency that loads on demand while the core it shares loads at startup", () => {
  const result = inspectStartup(
    [
      chunk("main.js", {
        isEntry: true,
        imports: ["core.js"],
        modules: { "/app/settings.ts": {}, "/node_modules/heavy/light/schemas.js": {} },
      }),
      chunk("core.js", { modules: { "/node_modules/heavy/core/parse.js": {} } }),
      chunk("command.js", {
        imports: ["core.js"],
        modules: { "/app/command.ts": {}, "/node_modules/heavy/full/schemas.js": {} },
      }),
    ],
    new Set(),
    { maxBytes: 100, lazyOnly: [HEAVY] },
    heavyImporters,
  );
  expect(result.problems).toEqual([]);
});

it("rejects oversized startup code and incomplete graphs", () => {
  expect(
    inspectStartup([chunk("main.js", { isEntry: true })], new Set(), { maxBytes: 2 }).problems,
  ).toEqual(["Startup JavaScript is 3 bytes; limit is 2 bytes"]);
  expect(() => inspectStartup([], new Set(), { maxBytes: 2 })).toThrow("No startup entry");
  expect(() =>
    inspectStartup([chunk("main.js", { isEntry: true, imports: ["missing.js"] })], new Set(), {
      maxBytes: 100,
    }),
  ).toThrow("Missing startup chunk");
});

/** A throwaway project: `write` adds a file, `run` builds it from `main.js` under `rules`. */
function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), "startup-bundle-"));
  return {
    write(file: string, code: string) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), code);
    },
    run: (rules: StartupRules) =>
      build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [startupBundle(rules)],
        build: { write: false, minify: false, rolldownOptions: { input: join(root, "main.js") } },
      }),
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}

it("fails a real production build if a dynamically loaded View is also imported eagerly", async () => {
  const project = fixtureProject();
  const run = (maxBytes = 10_000) => project.run({ maxBytes });
  try {
    project.write("view.js", 'export const value = "view";');
    project.write("main.js", 'globalThis.loadView = () => import("./view.js");');
    const built = await run();
    if (Array.isArray(built) || !("output" in built)) throw new Error("Expected one build output");
    const reportAsset = built.output.find((item) => item.fileName === "startup-bundle.json");
    if (!reportAsset || reportAsset.type !== "asset") throw new Error("Missing startup report");
    const report: { bytes: number; chunks: string[] } = JSON.parse(String(reportAsset.source));
    expect(report.bytes).toBe(
      built.output.reduce(
        (total, item) =>
          total +
          (item.type === "chunk" && report.chunks.includes(item.fileName)
            ? Buffer.byteLength(item.code)
            : 0),
        0,
      ),
    );
    await expect(run(1)).rejects.toThrow("Startup JavaScript");
    project.write(
      "main.js",
      'import { value } from "./view.js"; console.log(value); globalThis.loadView = () => import("./view.js");',
    );
    await expect(run()).rejects.toThrow("Lazy module entered the startup bundle");
  } finally {
    project.remove();
  }
});

it("fails a real production build if startup code imports a lazy-only dependency", async () => {
  const project = fixtureProject();
  const run = () => project.run({ maxBytes: 10_000, lazyOnly: [HEAVY] });
  const loadCommand = 'globalThis.loadCommand = () => import("./command.js");';
  try {
    project.write("node_modules/heavy/core/parse.js", "export const parse = (value) => value;");
    project.write(
      "node_modules/heavy/full/schemas.js",
      'import { parse } from "../core/parse.js"; export const full = (value) => parse([value]);',
    );
    project.write("node_modules/heavy/index.js", 'export { full } from "./full/schemas.js";');
    project.write(
      "node_modules/heavy/light.js",
      'import { parse } from "./core/parse.js"; export const light = (value) => parse(value);',
    );
    project.write(
      "command.js",
      'import { full } from "./node_modules/heavy/index.js"; export default full("command");',
    );
    // The light build at startup and the full one on demand share the core: allowed.
    project.write(
      "main.js",
      `import { light } from "./node_modules/heavy/light.js"; console.log(light("main")); ${loadCommand}`,
    );
    await run();
    project.write(
      "main.js",
      `import { full } from "./node_modules/heavy/index.js"; console.log(full("main")); ${loadCommand}`,
    );
    await expect(run()).rejects.toThrow(
      /The heavy build entered the startup bundle, imported by \S*main\.js: use its light build\./,
    );
  } finally {
    project.remove();
  }
});

describe("the web app's startup rules", () => {
  const directory = "/repo/packages/icons/src/directory/index.ts";
  const mark = "/repo/packages/ui/src/entry-mark.tsx";
  const picker = "/repo/packages/ui/src/entry-pickers/entry-icon-picker.tsx";
  const emojiTab = "/repo/packages/ui/src/entry-pickers/emoji-tab.tsx";
  const emojiLoader = "/repo/packages/ui/src/entry-pickers/emoji-data.ts";
  // The paths pnpm gives the two packages, with the peer dependencies in the folder name.
  const emojiPicker =
    "/repo/node_modules/.pnpm/@mantine+emoji@9.8.0_@mantine+core@9.8.0/node_modules/@mantine/emoji/esm/components/EmojiPicker/EmojiPicker.mjs";
  const emojiData =
    "/repo/node_modules/.pnpm/emojibase-data@18.0.0_emojibase@18.0.0/node_modules/emojibase-data/de/data.json";
  const importers: Readonly<Record<string, readonly string[]>> = {
    [directory]: [mark],
    [mark]: ["/repo/packages/shell/src/shell.tsx"],
    [emojiPicker]: [emojiTab],
    [emojiData]: [emojiLoader],
    [emojiLoader]: [emojiTab],
    [emojiTab]: [picker],
  };
  const inspect = (startup: Record<string, unknown>, onDemand: Record<string, unknown>) =>
    inspectStartup(
      [
        chunk("main.js", { isEntry: true, modules: startup }),
        chunk("view.js", { modules: onDemand }),
      ],
      new Set(),
      LAZY_ONLY_RULES,
      (id) => importers[id] ?? [],
    ).problems;

  it("accept the directory of entry pictures in a View that loads on demand", () => {
    expect(
      inspect({ "/repo/packages/shell/src/shell.tsx": {} }, { [directory]: {}, [mark]: {} }),
    ).toEqual([]);
  });

  it("reject the directory of entry pictures at startup and name the code that imports it", () => {
    expect(
      inspect({ "/repo/packages/shell/src/shell.tsx": {}, [mark]: {}, [directory]: {} }, {}),
    ).toEqual([
      "The directory of entry pictures entered the startup bundle, imported by /repo/packages/ui/src/entry-mark.tsx: draw an entry's icon with the mark of @self-engine/ui/entry-mark only in a View that loads on demand.",
    ]);
  });

  it("accept the emoji picker and its data in a chunk that loads when the Emoji tab opens", () => {
    expect(
      inspect(
        { [picker]: {} },
        { [emojiTab]: {}, [emojiLoader]: {}, [emojiPicker]: {}, [emojiData]: {} },
      ),
    ).toEqual([]);
  });

  it("reject the emoji picker at startup and name the code that imports it", () => {
    expect(
      inspect(
        { [picker]: {}, [emojiTab]: {}, [emojiPicker]: {} },
        { [emojiLoader]: {}, [emojiData]: {} },
      ),
    ).toEqual([
      "Mantine's emoji picker entered the startup bundle, imported by /repo/packages/ui/src/entry-pickers/emoji-tab.tsx: import it only from the Emoji tab of the icon field, which loads when the tab first opens.",
    ]);
  });

  describe.each([
    [
      "@mantine/form",
      "/repo/node_modules/.pnpm/@mantine+form@9.8.0_react@19.3.0/node_modules/@mantine/form/esm/use-form.mjs",
      "The form library",
    ],
    [
      "@mantine/dates",
      "/repo/node_modules/.pnpm/@mantine+dates@9.8.0_@mantine+core@9.8.0_dayjs@1.11.20/node_modules/@mantine/dates/esm/components/DatePicker/DatePicker.mjs",
      "Mantine's date fields",
    ],
    [
      "@mantine/dates/styles.css",
      "/repo/node_modules/.pnpm/@mantine+dates@9.8.0_@mantine+core@9.8.0_dayjs@1.11.23/node_modules/@mantine/dates/styles.css",
      "Mantine's date fields",
    ],
    [
      "dayjs",
      "/repo/node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/dayjs.min.js",
      "The date library of Mantine's date fields",
    ],
  ])("%s", (_library, library, name) => {
    const draft = "/repo/packages/forms/src/draft-form.ts";
    const drawer = "/repo/packages/module/src/edit-drawer.tsx";
    const formImporters: Readonly<Record<string, readonly string[]>> = {
      [library]: [draft],
      [draft]: [drawer],
    };
    const inspectForm = (startup: Record<string, unknown>, onDemand: Record<string, unknown>) =>
      inspectStartup(
        [
          chunk("main.js", { isEntry: true, modules: startup }),
          chunk("drawer.js", { modules: onDemand }),
        ],
        new Set(),
        LAZY_ONLY_RULES,
        (id) => formImporters[id] ?? [],
      ).problems;

    it("is accepted in an Edit Drawer that loads on demand", () => {
      expect(inspectForm({}, { [drawer]: {}, [draft]: {}, [library]: {} })).toEqual([]);
    });

    it("is rejected at startup, naming the code that imports it", () => {
      expect(inspectForm({ [drawer]: {}, [draft]: {}, [library]: {} }, {})).toEqual([
        `${name} entered the startup bundle, imported by ${draft}: build forms with @self-engine/forms only in an Edit Drawer or a View that loads on demand.`,
      ]);
    });
  });

  describe("a module's Contract", () => {
    const contract = "/repo/packages/module/src/contracts/index.ts";
    const drawer = "/repo/packages/module/src/edit-drawer.tsx";
    const shell = "/repo/packages/shell/src/shell.tsx";
    const contractImporters: Readonly<Record<string, readonly string[]>> = { [contract]: [drawer] };
    const inspectContract = (startup: Record<string, unknown>, onDemand: Record<string, unknown>) =>
      inspectStartup(
        [
          chunk("main.js", { isEntry: true, modules: startup }),
          chunk("drawer.js", { modules: onDemand }),
        ],
        new Set(),
        LAZY_ONLY_RULES,
        (id) => contractImporters[id] ?? [],
      ).problems;

    it("is accepted in the Edit Drawer whose form checks with it", () => {
      expect(inspectContract({ [shell]: {} }, { [drawer]: {}, [contract]: {} })).toEqual([]);
    });

    it("is rejected at startup, naming the code that imports it", () => {
      expect(inspectContract({ [shell]: {}, [drawer]: {}, [contract]: {} }, {})).toEqual([
        `A module's Contract entered the startup bundle, imported by ${drawer}: import it as a type in startup code, and at runtime only in an Edit Drawer that loads on demand, where a form checks with its input schema.`,
      ]);
    });
  });

  it("rejects a runtime import from a module's Row Map at startup", () => {
    const contribution = "/repo/packages/projects/src/index.ts";
    const rows = "/repo/packages/projects/src/data/rows.ts";
    const result = inspectStartup(
      [chunk("main.js", { isEntry: true, modules: { [contribution]: {}, [rows]: {} } })],
      new Set(),
      { ...LAZY_ONLY_RULES, maxBytes: STARTUP_RULES.maxBytes },
      (id) => (id === rows ? [contribution] : []),
    );
    expect(result.problems).toEqual([
      `A module's storage code entered the startup bundle, imported by ${contribution}: import its Row Map only as a type in its Shell Contribution.`,
    ]);
  });

  describe("the project picker", () => {
    const pickerEntry = "/repo/packages/projects/src/picker/index.tsx";
    const drawer = "/repo/packages/time-tracking/src/edit-drawer.tsx";
    const shell = "/repo/packages/shell/src/shell.tsx";
    const inspectPicker = (startup: Record<string, unknown>, onDemand: Record<string, unknown>) =>
      inspectStartup(
        [
          chunk("main.js", { isEntry: true, modules: startup }),
          chunk("drawer.js", { modules: onDemand }),
        ],
        new Set(),
        LAZY_ONLY_RULES,
        (id) => (id === pickerEntry ? [drawer] : []),
      ).problems;

    it("is accepted in the form of an Edit Drawer that loads on demand", () => {
      expect(inspectPicker({ [shell]: {} }, { [drawer]: {}, [pickerEntry]: {} })).toEqual([]);
    });

    it("is rejected at startup, naming the code that imports it", () => {
      expect(inspectPicker({ [shell]: {}, [drawer]: {}, [pickerEntry]: {} }, {})).toEqual([
        `The project picker entered the startup bundle, imported by ${drawer}: import @self-engine/projects/picker only from a form that loads on demand, such as an Edit Drawer's.`,
      ]);
    });
  });

  describe("a module's Module Indicator", () => {
    const indicator = "/repo/packages/placeholder-alpha/src/indicator/index.tsx";
    const contribution = "/repo/packages/placeholder-alpha/src/index.ts";
    const inspectIndicator = (
      startup: Record<string, unknown>,
      onDemand: Record<string, unknown>,
    ) =>
      inspectStartup(
        [
          chunk("main.js", { isEntry: true, modules: startup }),
          chunk("indicator.js", { modules: onDemand }),
        ],
        new Set(),
        LAZY_ONLY_RULES,
        (id) => (id === indicator ? [contribution] : []),
      ).problems;

    it("is accepted in a chunk that the Shell loads after the first paint", () => {
      expect(inspectIndicator({ [contribution]: {} }, { [indicator]: {} })).toEqual([]);
    });

    it("keeps its Indicator Panel out of the start as well, which lives in the same folder", () => {
      const panel = "/repo/packages/placeholder-alpha/src/indicator/panel.tsx";
      expect(
        inspectStartup(
          [chunk("main.js", { isEntry: true, modules: { [contribution]: {}, [panel]: {} } })],
          new Set(),
          LAZY_ONLY_RULES,
          (id) => (id === panel ? [contribution] : []),
        ).problems,
      ).toEqual([
        `A module's Module Indicator entered the startup bundle, imported by ${contribution}: import it only through the indicator's load in the module's Shell Contribution, which the Shell calls after the first paint.`,
      ]);
    });

    it("is rejected at startup, naming the code that imports it", () => {
      expect(inspectIndicator({ [contribution]: {}, [indicator]: {} }, {})).toEqual([
        `A module's Module Indicator entered the startup bundle, imported by ${contribution}: import it only through the indicator's load in the module's Shell Contribution, which the Shell calls after the first paint.`,
      ]);
    });
  });

  it("keep the frame of an Indicator Panel out of the start, naming the code that imports it", () => {
    const frame = "/repo/packages/shell/src/indicator-panel.tsx";
    const place = "/repo/packages/shell/src/module-indicators.tsx";
    const problems = (startup: Record<string, unknown>, onDemand: Record<string, unknown>) =>
      inspectStartup(
        [
          chunk("main.js", { isEntry: true, modules: startup }),
          chunk("frame.js", { modules: onDemand }),
        ],
        new Set(),
        LAZY_ONLY_RULES,
        (id) => (id === frame ? [place] : []),
      ).problems;
    expect(problems({ [place]: {} }, { [frame]: {} })).toEqual([]);
    expect(problems({ [place]: {}, [frame]: {} }, {})).toEqual([
      `The frame of an Indicator Panel entered the startup bundle, imported by ${place}: reach it only through LazyIndicatorPanelFrame of lazy-indicator-panel-frame.tsx, which loads it on demand.`,
    ]);
  });

  it("reject the emoji data at startup and name the code that imports it", () => {
    expect(
      inspect(
        { [picker]: {}, [emojiTab]: {}, [emojiLoader]: {}, [emojiData]: {} },
        { [emojiPicker]: {} },
      ),
    ).toEqual([
      "The emoji data entered the startup bundle, imported by /repo/packages/ui/src/entry-pickers/emoji-data.ts: load it with a dynamic import, one chunk per language, when the Emoji tab first opens.",
    ]);
  });
});

describe("a module that loads on demand", () => {
  const week = "/repo/packages/time-tracking/src/week.tsx";
  const address = "/repo/packages/time-tracking/src/project-filter-address.ts";
  const ids = "/repo/packages/projects/src/contracts/project-id.ts";
  const contract = "/repo/packages/projects/src/contracts/index.ts";
  const builder = "/repo/node_modules/@orpc/contract/dist/index.mjs";
  const drawer = "/repo/packages/time-tracking/src/edit-drawer.tsx";
  const importers: Readonly<Record<string, readonly string[]>> = {
    [builder]: [contract],
    [contract]: [address, drawer],
    [ids]: [address, contract],
  };
  const rules: StartupRules = {
    maxBytes: 100,
    onDemand: STARTUP_RULES.onDemand.filter((rule) => rule.path.endsWith("/week.tsx")),
  };
  const inspect = (week: Record<string, unknown>, shared: Record<string, unknown>) =>
    inspectStartup(
      [
        chunk("main.js", { isEntry: true }),
        chunk("week.js", { imports: ["shared.js"], modules: week }),
        chunk("shared.js", { modules: shared }),
        chunk("drawer.js", { modules: { [drawer]: {}, [contract]: {}, [builder]: {} } }),
      ],
      new Set(),
      rules,
      (id) => importers[id] ?? [],
    ).problems;

  it("accepts the week View with the light id entry while the drawer loads the Contract", () => {
    expect(inspect({ [week]: {}, [address]: {} }, { [ids]: {} })).toEqual([]);
  });

  it("rejects a Contract that a chunk of the week View brings and names the code that imports it", () => {
    expect(
      inspect({ [week]: {}, [address]: {} }, { [ids]: {}, [contract]: {}, [builder]: {} }),
    ).toEqual([
      `A module's Contract loads with The week View of time-tracking, imported by ${address}: import it as a type in a View; parse an id with the module's light id entry, such as @self-engine/projects/ids.`,
      `oRPC's contract builder loads with The week View of time-tracking, imported by ${contract}: import a Contract only as a type in a View; only a lazy form loads it.`,
    ]);
  });

  it("fails when the module of a rule is no longer in the build", () => {
    expect(inspect({ [address]: {} }, {})).toEqual([
      "The week View of time-tracking is missing from the build: no module matches /packages/time-tracking/src/week.tsx",
    ]);
  });
});
