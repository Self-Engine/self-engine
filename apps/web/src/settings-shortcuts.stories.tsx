import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { settingsStore } from "./settings-store.ts";
import { AppAt, openPalette, paletteGone, storyRouter } from "./story-app.tsx";
import { placeholderAlphaAnswers } from "@self-engine/placeholder-alpha/testing";

const SHORTCUTS = "/settings/shortcuts";

// The list over the app's real contributions: nothing in the settings area names a module.
const meta = {
  title: "App/Settings area/Shortcuts",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  args: { address: SHORTCUTS, access: placeholderAlphaAnswers() },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

/** ⌘ on macOS and Ctrl elsewhere; the stories of the settings area show each notation. */
const mod = (key: string) => new RegExp(`^(⌘|Ctrl\\+)${key}$`);

const groupOf = async (canvas: Canvas, name: string) =>
  within(await canvas.findByRole("region", { name }));

async function expectShortcutsView(canvas: Canvas) {
  await expect(await canvas.findByRole("heading", { name: "Shortcuts", level: 1 })).toBeVisible();
  await expect(await canvas.findByText("Open the Command Palette")).toBeVisible();
  await expect(storyRouter().state.location.pathname).toBe(SHORTCUTS);
}

export const ListsTheGeneralShortcutsFirst: Story = {
  play: async ({ canvas }) => {
    await expectShortcutsView(canvas);
    const general = await groupOf(canvas, "General");
    await expect(general.getByText("Open the Command Palette")).toBeVisible();
    await expect(await general.findByText(mod("K"))).toBeVisible();
    await expect(general.getByText("Undo")).toBeVisible();
    await expect(general.getByText(mod("Z"))).toBeVisible();
    await expect(
      canvas.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["General", "Placeholder Alpha"]);
  },
};

export const ListsThePlaceholderModulesCommandsThatHaveAShortcut: Story = {
  play: async ({ canvas }) => {
    await expectShortcutsView(canvas);
    const alpha = await groupOf(canvas, "Placeholder Alpha");
    await expect(alpha.getByText("New entry")).toBeVisible();
    await expect(await alpha.findByText(mod("N"))).toBeVisible();
    await expect(alpha.getByText("Add sample entry")).toBeVisible();
    // Placeholder Beta has no Command with a default shortcut.
    await expect(canvas.queryByRole("region", { name: "Placeholder Beta" })).toBeNull();
  },
};

export const IsAViewOfTheSettings: Story = {
  args: { address: "/settings/appearance" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("link", { name: "Shortcuts" }));
    await expectShortcutsView(canvas);
  },
};

export const ThePaletteJumpsToShortcuts: Story = {
  args: { address: "/placeholder-beta/overview" },
  play: async ({ canvas }) => {
    await canvas.findByText("The minimal module View.");
    await openPalette();
    await userEvent.keyboard("shortcuts{Enter}");
    await paletteGone();
    await expectShortcutsView(canvas);
  },
};

export const SearchingForUndoShowsItsShortcut: Story = {
  args: { address: "/settings/appearance" },
  play: async ({ canvas }) => {
    await userEvent.type(await canvas.findByRole("searchbox", { name: "Search settings" }), "undo");
    const shortcuts = await groupOf(canvas, "Shortcuts");
    await expect(shortcuts.getByText("Undo")).toBeVisible();
    await expect(await shortcuts.findByText(mod("Z"))).toBeVisible();
    await expect(canvas.queryByRole("radiogroup", { name: "Color Mode" })).toBeNull();
  },
};
