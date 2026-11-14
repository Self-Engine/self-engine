import { answersByMount } from "@self-engine/data-client/testing";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { loadStoryApp, AppAt, openPalette, paletteGone, storyRouter } from "./story-app.tsx";
import { placeholderAlphaAnswers } from "@self-engine/placeholder-alpha/testing";
import { backupAnswers } from "@self-engine/settings-area/testing";

const SHORTCUTS = "/settings/shortcuts";

/**
 * What the Port answers while the settings are shown: the rows of `placeholder-alpha`, and the
 * Backups, whose rows the View Data and a search show.
 */
const settingsAnswers = () =>
  answersByMount({ placeholderAlpha: placeholderAlphaAnswers(), backups: backupAnswers() });

// The list over the app's real contributions: nothing in the settings area names a module.
const meta = {
  title: "App/Settings area/Shortcuts",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [loadStoryApp],
  args: { address: SHORTCUTS, access: settingsAnswers() },
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
    ).toEqual(["General", "Placeholder Alpha", "Projects"]);
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

export const ListsNewProjectWithItsShortcut: Story = {
  play: async ({ canvas }) => {
    await expectShortcutsView(canvas);
    const projects = await groupOf(canvas, "Projects");
    await expect(projects.getByText("New project")).toBeVisible();
    await expect(await projects.findByText(mod("N"))).toBeVisible();
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
