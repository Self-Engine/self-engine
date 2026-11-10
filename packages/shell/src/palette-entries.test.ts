import { describe, expect, test } from "vite-plus/test";
import type { InputCommand, OpenCommand, PageCommand } from "./commands.ts";
import {
  type EntryTools,
  isViewEntry,
  type PaletteEntry,
  paletteEntries,
  type PaletteGroup,
  type PaletteOwner,
  paletteGroups,
} from "./palette-entries.ts";

const label = (message: string) => ({ id: message, message });
const load = () => Promise.reject(new Error("the palette never loads a Command"));

const page = (name: string): PageCommand => ({
  id: name,
  kind: "page",
  label: label(name),
  load,
});
const open = (name: string): OpenCommand => ({
  id: name,
  kind: "open",
  label: label(name),
  load,
});
const view = (name: string) => ({ id: name, title: label(name) });

const tools: EntryTools = {
  translate: (descriptor) => descriptor.message!,
  formatShortcut: (shortcut) => `<${shortcut}>`,
};

const entriesOf = (owners: readonly PaletteOwner[], activeModuleId?: string) =>
  paletteEntries(owners, activeModuleId, tools);

const labels = (groups: readonly PaletteGroup[]) =>
  groups.flatMap((group) => group.entries.map((entry) => entry.label));

const commandEntry = (entries: readonly PaletteEntry[], name: string) => {
  const entry = entries.find((candidate) => candidate.label === name);
  if (entry === undefined || isViewEntry(entry)) throw new Error(`no Command named ${name}`);
  return entry;
};

describe("the entries", () => {
  test("stand in the order of the contributions, a module's Commands before its Views", () => {
    const entries = entriesOf([
      { id: "b", views: [view("B view")], commands: [open("B open")] },
      { id: "a", views: [view("A view")], commands: [open("A open")] },
    ]);
    expect(entries.map((entry) => entry.label)).toEqual(["B open", "B view", "A open", "A view"]);
  });

  test("never hold an input Command", () => {
    const input: InputCommand = { id: "secret", kind: "input", load };
    expect(entriesOf([{ id: "a", commands: [input] }])).toEqual([]);
  });

  test("send another module's page Command to that module's default View first", () => {
    const owners = [{ id: "a", views: [view("home"), view("other")], commands: [page("New")] }];
    expect(commandEntry(entriesOf(owners, "b"), "New").goFirstTo).toBe("/a/home");
    expect(commandEntry(entriesOf(owners, "a"), "New").goFirstTo).toBeUndefined();
  });

  test("leave out another module's page Command when that module has no View", () => {
    const owners = [{ id: "a", commands: [page("New"), open("Refresh")] }];
    expect(entriesOf(owners, "b").map((entry) => entry.label)).toEqual(["Refresh"]);
  });

  test("show a shortcut in the notation of the platform", () => {
    const owners = [{ id: "a", commands: [{ ...open("Keyed"), defaultShortcut: "Mod+J" }] }];
    expect(commandEntry(entriesOf(owners), "Keyed").shortcut).toBe("<Mod+J>");
  });
});

describe("an empty search", () => {
  const OWNERS: readonly PaletteOwner[] = [
    {
      id: "other",
      views: [view("Other view")],
      commands: [page("Other page"), open("Other open")],
    },
    { id: "here", views: [view("Here view")], commands: [page("Here page"), open("Here open")] },
  ];

  test("lists the active module's Commands, its Views, then the others' open Commands", () => {
    expect(labels(paletteGroups(entriesOf(OWNERS, "here"), "here", ""))).toEqual([
      "Here page",
      "Here open",
      "Here view",
      "Other open",
    ]);
  });

  test("lists only open Commands when no module is active", () => {
    expect(labels(paletteGroups(entriesOf(OWNERS), undefined, "   "))).toEqual([
      "Other open",
      "Here open",
    ]);
  });
});

describe("a search", () => {
  const search = (owners: readonly PaletteOwner[], query: string, active?: string) =>
    labels(paletteGroups(entriesOf(owners, active), active, query));

  test("puts a word start before the inside of a word", () => {
    const owners = [{ id: "a", commands: [open("Support"), open("Port plan"), open("Re-port")] }];
    expect(search(owners, "port")).toEqual(["Port plan", "Re-port", "Support"]);
  });

  test("counts a later word start even when the first match is inside a word", () => {
    const owners = [{ id: "a", commands: [open("Support"), open("Airport port")] }];
    expect(search(owners, "port")).toEqual(["Airport port", "Support"]);
  });

  test("puts the active module next, also ahead of an earlier contribution", () => {
    const owners = [
      { id: "other", commands: [open("Port other")] },
      { id: "here", commands: [open("Port here")] },
    ];
    expect(search(owners, "port", "here")).toEqual(["Port here", "Port other"]);
  });

  test("does not let the active module overtake a better match", () => {
    const owners = [
      { id: "other", commands: [open("Port other")] },
      { id: "here", commands: [open("Support here")] },
    ];
    expect(search(owners, "port", "here")).toEqual(["Port other", "Support here"]);
  });

  test("keeps the order of the contributions among equals", () => {
    const owners = [
      { id: "b", commands: [open("Port b")] },
      { id: "a", commands: [open("Port a")] },
    ];
    expect(search(owners, "port")).toEqual(["Port b", "Port a"]);
  });

  test("ignores case and the space around the query", () => {
    expect(search([{ id: "a", commands: [open("Port plan")] }], "  PORT ")).toEqual(["Port plan"]);
  });

  test("finds nothing without a match", () => {
    expect(search([{ id: "a", commands: [open("Port plan")] }], "zebra")).toEqual([]);
  });
});

describe("the groups", () => {
  const manyViews = Array.from({ length: 9 }, (_, index) => view(`View ${index}`));

  test("hold at most eight rows, on an empty search and on a search", () => {
    const entries = entriesOf([{ id: "a", views: manyViews }], "a");
    expect(labels(paletteGroups(entries, "a", ""))).toHaveLength(8);
    expect(labels(paletteGroups(entries, "a", "view"))).toHaveLength(8);
  });

  test("keep a module's rows together and stand in the order of their best match", () => {
    const entries = entriesOf([
      { id: "first", commands: [open("Support first")] },
      { id: "second", commands: [open("Port second"), open("Export second")] },
    ]);
    const groups = paletteGroups(entries, undefined, "port");
    expect(groups.map((group) => group.moduleId)).toEqual(["second", "first"]);
    expect(labels(groups)).toEqual(["Port second", "Export second", "Support first"]);
  });

  test("carry the module's translated name, and none for the Shell's own Commands", () => {
    const entries = entriesOf([
      { id: "a", name: label("Module a"), commands: [open("Port a")] },
      { id: "shell", commands: [open("Port shell")] },
    ]);
    expect(paletteGroups(entries, undefined, "port").map((group) => group.moduleName)).toEqual([
      "Module a",
      undefined,
    ]);
  });
});
