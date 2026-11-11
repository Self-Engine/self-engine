import type { MessageDescriptor } from "@lingui/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, spyOn, userEvent, within } from "storybook/test";
import type { NamedCommandOwner } from "./index.ts";
import { storyViewPage } from "./story-page.tsx";
import { loadedStoreOn, memoryStorage } from "./story-store.ts";

const text = (message: string): MessageDescriptor => ({ id: `story-${message}`, message });
const load = () => Promise.reject(new Error("The list never loads a Command"));

const OWNERS: readonly NamedCommandOwner[] = [
  {
    id: "projects",
    name: text("Projects"),
    commands: [
      { id: "create", kind: "page", label: text("New project"), defaultShortcut: "Mod+N", load },
      { id: "archive", kind: "open", label: text("Archive project"), load },
      { id: "import", kind: "input", load },
    ],
  },
  { id: "habits", name: text("Habits") },
  {
    id: "time",
    name: text("Time"),
    commands: [
      { id: "start", kind: "open", label: text("Start timer"), defaultShortcut: "Mod+J", load },
    ],
  },
];

/** The hotkey library reads the platform when it writes a shortcut, so a story can choose it. */
function pretendPlatform(platform: string, userAgent: string) {
  const spies = [
    spyOn(navigator, "platform", "get").mockReturnValue(platform),
    spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent),
  ];
  return () => {
    for (const spy of spies) spy.mockRestore();
  };
}
const onWindows = () => pretendPlatform("Win32", "Windows NT");
const onMac = () => pretendPlatform("MacIntel", "Macintosh");

const meta = {
  title: "Settings area/Shortcuts",
  loaders: [
    async (): Promise<{ readonly Page: ComponentType }> => {
      // Loaded, because a search also draws the controls of the other Views.
      const store = await loadedStoreOn(memoryStorage());
      return { Page: storyViewPage("shortcuts", { store, commandOwners: OWNERS }) };
    },
  ],
  render: (_args, { loaded }) => {
    const { Page } = loaded as { readonly Page: ComponentType };
    return <Page />;
  },
  beforeEach: onWindows,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

const groupOf = (canvas: Canvas, name: string) => within(canvas.getByRole("region", { name }));
const headings = (canvas: Canvas) =>
  canvas.getAllByRole("heading").map((heading: HTMLElement) => heading.textContent);

export const GroupedByModuleWithTheGeneralOnesFirst: Story = {
  play: async ({ canvas }) => {
    // Habits has no Command, so it has no heading either.
    await expect(headings(canvas)).toEqual(["General", "Projects", "Time"]);
    const general = groupOf(canvas, "General");
    await expect(general.getByText("Open the Command Palette")).toBeVisible();
    // The notation appears once the hotkey library has loaded.
    await expect(await general.findByText("Ctrl+K")).toBeVisible();
    await expect(general.getByText("Undo")).toBeVisible();
    await expect(general.getByText("Ctrl+Z")).toBeVisible();
    const projects = groupOf(canvas, "Projects");
    await expect(projects.getByText("New project")).toBeVisible();
    await expect(projects.getByText("Ctrl+N")).toBeVisible();
    await expect(groupOf(canvas, "Time").getByText("Ctrl+J")).toBeVisible();
  },
};

export const ACommandWithoutADefaultShortcutIsLeftOut: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Ctrl+N")).toBeVisible();
    await expect(canvas.queryByText("Archive project")).toBeNull();
    await expect(canvas.queryByRole("region", { name: "Habits" })).toBeNull();
  },
};

export const InTheNotationOfMacOS: Story = {
  beforeEach: onMac,
  play: async ({ canvas }) => {
    const general = groupOf(canvas, "General");
    await expect(await general.findByText("⌘K")).toBeVisible();
    await expect(general.getByText("⌘Z")).toBeVisible();
    await expect(groupOf(canvas, "Projects").getByText("⌘N")).toBeVisible();
    await expect(canvas.queryByText(/Ctrl/)).toBeNull();
  },
};

export const TheSearchFindsAShortcutByItsCommand: Story = {
  beforeEach: onMac,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("searchbox", { name: "Search settings" }), "undo");
    const shortcuts = groupOf(canvas, "Shortcuts");
    await expect(shortcuts.getByText("Undo")).toBeVisible();
    await expect(await shortcuts.findByText("⌘Z")).toBeVisible();
    // The hit still says which module it belongs to.
    await expect(headings(canvas)).toEqual(["Shortcuts", "General"]);
    await expect(canvas.queryByText("New project")).toBeNull();
  },
};

/** Shortcuts only displays (D203): nothing can be pressed or changed. */
export const OffersNothingToChange: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Ctrl+K")).toBeVisible();
    for (const role of ["button", "link", "radio", "switch", "combobox", "checkbox"]) {
      await expect(canvas.queryAllByRole(role)).toEqual([]);
    }
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    const general = groupOf(canvas, "Allgemein");
    await expect(general.getByText("Befehlspalette öffnen")).toBeVisible();
    await expect(general.getByText("Rückgängig")).toBeVisible();
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Einstellungen durchsuchen" }),
      "rück",
    );
    await expect(groupOf(canvas, "Tastenkürzel").getByText("Rückgängig")).toBeVisible();
  },
};
