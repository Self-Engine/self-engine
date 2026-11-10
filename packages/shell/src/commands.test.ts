import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import { auditCommands } from "./command-audit.ts";
import {
  commandRegister,
  defineInputCommand,
  defineOpenCommand,
  definePageCommand,
  type InputCommand,
  type OpenCommand,
  type PageCommand,
  type ShellCommand,
} from "./commands.ts";
import { defineContribution, validateContributions } from "./contributions.ts";
import { shellCommands } from "./shell-commands.ts";

const label = { id: "Label" };
const noInput = z.object({});
const required = z.object({ name: z.string() });
const body = { description: "Does a thing.", run: () => undefined };

const page = {
  id: "page-thing",
  kind: "page",
  label,
  load: async () => ({ default: definePageCommand({ ...body, schema: noInput }) }),
} as const satisfies PageCommand;
const open = {
  id: "open-thing",
  kind: "open",
  label,
  load: async () => ({ default: defineOpenCommand({ ...body, schema: noInput }) }),
} as const satisfies OpenCommand;
const input = {
  id: "input-thing",
  kind: "input",
  load: async () => ({ default: defineInputCommand({ ...body, schema: required }) }),
} as const satisfies InputCommand;

describe("the register", () => {
  test("forms the full id from the module's id and the Command's short id", () => {
    expect(
      commandRegister([
        { id: "alpha", commands: [page, input] },
        { id: "beta", commands: [page] },
        { id: "gamma" },
      ]).map(({ fullId, moduleId }) => [fullId, moduleId]),
    ).toEqual([
      ["alpha.page-thing", "alpha"],
      ["alpha.input-thing", "alpha"],
      ["beta.page-thing", "beta"],
    ]);
  });

  test("holds the Shell's undo as an open Command, which the palette will list", () => {
    expect(
      commandRegister([shellCommands]).map(({ fullId, command }) => [
        fullId,
        command.kind,
        command.defaultShortcut,
      ]),
    ).toEqual([["shell.undo", "open", "Mod+Z"]]);
  });

  test("no module may be called shell, the prefix of the Shell's own Commands", () => {
    expect(() => validateContributions([{ id: "shell", views: [{ id: "overview" }] }])).toThrow(
      "reserved",
    );
  });
});

describe("the audit over all contributions", () => {
  test("is silent when ids are unique and each kind matches its schema", async () => {
    await expect(auditCommands([{ id: "alpha", commands: [page, open, input] }])).resolves.toEqual(
      [],
    );
  });

  test("names a duplicate full id", async () => {
    await expect(auditCommands([{ id: "alpha", commands: [page, page] }])).resolves.toEqual([
      "Duplicate Command id: alpha.page-thing",
    ]);
  });

  // A refinement is invisible to the types, so only the audit can see these.
  test("names a page or open Command whose schema refuses an empty object", async () => {
    const refusing = noInput.refine(() => false);
    const loadPage = async () => ({
      default: definePageCommand({ ...body, schema: refusing }),
    });
    const loadOpen = async () => ({
      default: defineOpenCommand({ ...body, schema: refusing }),
    });
    await expect(
      auditCommands([
        {
          id: "alpha",
          commands: [
            { ...page, load: loadPage },
            { ...open, load: loadOpen },
          ],
        },
      ]),
    ).resolves.toEqual([
      "alpha.page-thing: kind page needs a schema that accepts an empty object",
      "alpha.open-thing: kind open needs a schema that accepts an empty object",
    ]);
  });

  test("names an input Command whose schema accepts an empty object", async () => {
    // z.custom checks nothing, while its type still says that the name is required.
    const accepting = z.custom<{ name: string }>();
    const load = async () => ({ default: defineInputCommand({ ...body, schema: accepting }) });
    await expect(auditCommands([{ id: "alpha", commands: [{ ...input, load }] }])).resolves.toEqual(
      ["alpha.input-thing: kind input needs a schema that refuses an empty object"],
    );
  });
});

describe("the audit of default shortcuts", () => {
  const pageOn = (id: string, defaultShortcut: string) => ({ ...page, id, defaultShortcut });
  const openOn = (id: string, defaultShortcut: string) => ({ ...open, id, defaultShortcut });

  test("is silent for Mod shortcuts, also when two modules share a page shortcut", async () => {
    await expect(
      auditCommands([
        { id: "alpha", commands: [pageOn("new", "Mod+N"), openOn("sample", "Mod+Shift+E")] },
        { id: "beta", commands: [pageOn("new", "Mod+N")] },
      ]),
    ).resolves.toEqual([]);
  });

  test.each([
    ["Mod+Foo+N", "unknown-modifier"],
    ["Mod+Shift", "modifier-only"],
    ["", "empty"],
  ])("names the invalid shortcut %j", async (shortcut, reason) => {
    await expect(
      auditCommands([{ id: "alpha", commands: [pageOn("new", shortcut)] }]),
    ).resolves.toEqual([`alpha.new: default shortcut "${shortcut}" is invalid (${reason})`]);
  });

  test.each(["N", "Shift+N", "Control+N", "Meta+N", "Alt+N"])(
    "names %j, which has no Mod",
    async (shortcut) => {
      await expect(
        auditCommands([{ id: "alpha", commands: [pageOn("new", shortcut)] }]),
      ).resolves.toEqual([`alpha.new: default shortcut "${shortcut}" needs Mod`]);
    },
  );

  test.each([
    "Mod+C",
    "Mod+V",
    "Mod+X",
    "Mod+A",
    "Mod+Z",
    "Mod+K",
    "Mod+Shift+Z",
    "Mod+Y",
    "Mod+W",
    "Mod+Q",
    "Mod+R",
    "Mod+Shift+R",
    "Mod+M",
    "Mod+H",
    "Mod+Alt+H",
    "Mod+Shift+H",
    "Mod+Shift+V",
    "Mod+Alt+Shift+V",
    "Mod+Shift+I",
    "Mod+Alt+I",
    "Mod+0",
    "Mod+=",
    "Mod+-",
  ])("names %j, which is reserved", async (shortcut) => {
    await expect(
      auditCommands([{ id: "alpha", commands: [pageOn("new", shortcut)] }]),
    ).resolves.toEqual([`alpha.new: default shortcut "${shortcut}" is reserved`]);
  });

  test("the Shell's undo may take Mod+Z, the single exception to the reserved keys", async () => {
    await expect(auditCommands([shellCommands])).resolves.toEqual([]);
  });

  test("the exception holds for that Command on that key only", async () => {
    await expect(
      auditCommands([
        { id: "shell", commands: [openOn("undo", "Mod+Y"), openOn("other", "Mod+Z")] },
      ]),
    ).resolves.toEqual([
      'shell.undo: default shortcut "Mod+Y" is reserved',
      'shell.other: default shortcut "Mod+Z" is reserved',
    ]);
  });

  test("a reserved key is found however the shortcut is written", async () => {
    await expect(
      auditCommands([{ id: "alpha", commands: [pageOn("new", "Shift+Mod+z")] }]),
    ).resolves.toEqual([`alpha.new: default shortcut "Shift+Mod+z" is reserved`]);
  });

  test("names two page Commands of one module on the same shortcut", async () => {
    await expect(
      auditCommands([
        { id: "alpha", commands: [pageOn("new", "Mod+N"), pageOn("other", "Mod+n")] },
      ]),
    ).resolves.toEqual(["Shortcut Mod+N is used twice: alpha.new and alpha.other"]);
  });

  test("names an open shortcut that a page Command of any module also uses", async () => {
    await expect(
      auditCommands([
        { id: "alpha", commands: [pageOn("new", "Mod+N")] },
        { id: "beta", commands: [openOn("sample", "Mod+N")] },
      ]),
    ).resolves.toEqual(["Shortcut Mod+N is used twice: alpha.new and beta.sample"]);
  });

  test("names two open Commands on the same shortcut, across modules", async () => {
    await expect(
      auditCommands([
        { id: "alpha", commands: [openOn("one", "Mod+Shift+E")] },
        { id: "beta", commands: [openOn("two", "Shift+Mod+E")] },
      ]),
    ).resolves.toEqual(["Shortcut Mod+Shift+E is used twice: alpha.one and beta.two"]);
  });
});

const views = [
  { id: "overview", title: label, load: async () => ({ default: () => null }) },
] as const;
const module = { id: "example", name: label, icon: () => null, color: "blue", views } as const;

// Compiled, not run: what a module author cannot write.
function whatCannotBeDeclared() {
  definePageCommand({
    ...body,
    schema: noInput,
    run: (_input, { writeSearch }) => writeSearch((search) => search),
  });
  defineOpenCommand({
    ...body,
    schema: noInput,
    // @ts-expect-error Only a page Command gets the address capability.
    run: (_input, { writeSearch }) => writeSearch,
  });
  defineInputCommand({
    ...body,
    schema: required,
    // @ts-expect-error Only a page Command gets the address capability.
    run: (_input, { writeSearch }) => writeSearch,
  });
  // @ts-expect-error A page Command cannot have required input: nobody could start it.
  definePageCommand({ ...body, schema: required });
  // @ts-expect-error An open Command is started with an empty object.
  defineOpenCommand({ ...body, schema: required });
  // @ts-expect-error An input Command has required input, or it would be an open Command.
  defineInputCommand({ ...body, schema: noInput });
  // @ts-expect-error A handler is checked against its own schema.
  defineInputCommand({ ...body, schema: required, run: (values: { other: number }) => values });

  const forged = { ...body, schema: noInput };
  const forgedLoad = async () => ({ default: forged });
  // @ts-expect-error A Command's loaded file goes through its define function.
  const unchecked: PageCommand = { id: "x", kind: "page", label, load: forgedLoad };

  const loadPage = page.load;
  // @ts-expect-error A Command's kind and the kind of its loaded file are the same.
  const mismatched: OpenCommand = { id: "x", kind: "open", label, load: loadPage };

  // @ts-expect-error An input Command has no label.
  const labelled: InputCommand = { ...input, label };
  // @ts-expect-error An input Command has no shortcut.
  const bound: InputCommand = { ...input, defaultShortcut: "Mod+I" };
  // @ts-expect-error A Command a person can start has a label.
  const unlabelled: ShellCommand = { id: "x", kind: "open", load: open.load };

  defineContribution({ ...module, commands: [page, open, input], primaryAction: page });
  defineContribution({ ...module, commands: [page, open, input], primaryAction: open });
  // @ts-expect-error A main action cannot be an input Command.
  defineContribution({ ...module, commands: [page, open, input], primaryAction: input });
  void [unchecked, mismatched, labelled, bound, unlabelled];
}
void whatCannotBeDeclared;
