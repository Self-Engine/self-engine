import { Stack } from "@mantine/core";
import { createSettingsStore, type SettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import {
  BUILT_IN_THEMES,
  COLOR_SETS,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  type Theme,
  type ThemeCatalog,
} from "@self-engine/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Row } from "./area.tsx";
import { APPEARANCE_SETTINGS, appearanceChanges } from "./settings.ts";
import { accentRow, themeRow } from "./theme-rows.tsx";

const NEUTRAL = BUILT_IN_THEMES["neutral"] as Theme;

/** Only light, and with an Accent of its own. */
const PAPER: Theme = {
  version: 1,
  id: "paper",
  name: "Paper",
  colors: { light: { ...NEUTRAL.colors.light!, canvas: "#fdf6e3", chrome: "#eee8d5" } },
  accent: { light: COLOR_SETS.pink.light },
};

/** Only dark, and without an Accent. */
const INK: Theme = {
  version: 1,
  id: "ink",
  name: "Ink",
  colors: { dark: { ...NEUTRAL.colors.dark!, canvas: "#002b36", chrome: "#073642" } },
};

const CATALOG: ThemeCatalog = { neutral: NEUTRAL, paper: PAPER, ink: INK };
const ROWS = [themeRow(CATALOG), accentRow(CATALOG)];

interface Loaded {
  readonly store: SettingsStore;
}

const meta = {
  title: "Settings area/Theme and Accent",
  loaders: [
    async (): Promise<Loaded> => {
      const store = createSettingsStore({
        adapters: { synced: createTestAdapter(), device: createTestAdapter() },
        onError: ({ error }) => {
          throw error;
        },
      });
      await store.load();
      return { store };
    },
  ],
  render: (_args, { loaded }) => {
    const { store } = loaded as Loaded;
    return (
      <Stack gap={0} maw="48rem">
        {ROWS.map((row) => (
          <Row key={row.id} row={row} store={store} />
        ))}
      </Stack>
    );
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const namesIn = (group: HTMLElement) =>
  within(group)
    .getAllByRole("radio")
    .map((radio) => radio.getAttribute("aria-label") ?? radio.textContent);

/** A color as the browser reports a computed one. */
function computed(color: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

const shownRole = (card: HTMLElement, role: string) =>
  getComputedStyle(card.querySelector(`[data-color-role="${role}"]`) as HTMLElement)
    .backgroundColor;

export const APickerListsOnlyTheThemesOfItsColorMode: Story = {
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;

    // The default follows the system, so each Color Mode has a picker.
    await expect(canvas.queryByRole("radiogroup", { name: "Theme" })).toBeNull();
    await expect(namesIn(canvas.getByRole("radiogroup", { name: "Theme for light" }))).toEqual([
      "Neutral",
      "Paper",
    ]);
    await expect(namesIn(canvas.getByRole("radiogroup", { name: "Theme for dark" }))).toEqual([
      "Neutral",
      "Ink",
    ]);

    store.write(APPEARANCE_SETTINGS.colorMode, "dark");
    await waitFor(() =>
      expect(namesIn(canvas.getByRole("radiogroup", { name: "Theme" }))).toEqual([
        "Neutral",
        "Ink",
      ]),
    );
    await expect(canvas.queryByRole("radiogroup", { name: "Theme for light" })).toBeNull();
    await expect(canvas.queryByRole("radiogroup", { name: "Theme for dark" })).toBeNull();

    store.write(APPEARANCE_SETTINGS.colorMode, "light");
    await waitFor(() =>
      expect(namesIn(canvas.getByRole("radiogroup", { name: "Theme" }))).toEqual([
        "Neutral",
        "Paper",
      ]),
    );
  },
};

export const ACardShowsItsThemeInTheColorsOfItsPicker: Story = {
  play: async ({ canvas }) => {
    const light = within(canvas.getByRole("radiogroup", { name: "Theme for light" }));
    const dark = within(canvas.getByRole("radiogroup", { name: "Theme for dark" }));
    const resolved = (theme: string) =>
      resolveAppearance({ ...DEFAULT_APPEARANCE, lightTheme: theme, darkTheme: theme }, CATALOG);

    const neutralLight = light.getByRole("radio", { name: "Neutral" });
    await expect(within(neutralLight).getByText("Neutral")).toBeVisible();
    await expect(shownRole(neutralLight, "canvas")).toBe(computed("#ffffff"));
    await expect(shownRole(neutralLight, "chrome")).toBe(
      computed(resolved("neutral").light.roles.chrome),
    );
    await expect(shownRole(dark.getByRole("radio", { name: "Neutral" }), "canvas")).toBe(
      computed("#141416"),
    );

    const paper = light.getByRole("radio", { name: "Paper" });
    await expect(shownRole(paper, "canvas")).toBe(computed("#fdf6e3"));
    // The Theme's own Accent, because the Accent is "From Theme".
    await expect(shownRole(paper, "accent")).toBe(computed(COLOR_SETS.pink.light.accent));
    await expect(shownRole(dark.getByRole("radio", { name: "Ink" }), "canvas")).toBe(
      computed("#002b36"),
    );

    await expect(neutralLight).toBeChecked();
    await expect(paper).not.toBeChecked();
  },
};

export const ChoosingACardWritesTheThemeOfItsColorMode: Story = {
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    const light = within(canvas.getByRole("radiogroup", { name: "Theme for light" }));
    const dark = within(canvas.getByRole("radiogroup", { name: "Theme for dark" }));

    await userEvent.click(light.getByRole("radio", { name: "Paper" }));
    await expect(light.getByRole("radio", { name: "Paper" })).toBeChecked();
    await userEvent.click(dark.getByRole("radio", { name: "Ink" }));
    await expect(store.read(APPEARANCE_SETTINGS.lightTheme)).toBe("paper");
    await expect(store.read(APPEARANCE_SETTINGS.darkTheme)).toBe("ink");

    // On a fixed Color Mode the one picker writes that mode's Theme and leaves the other alone.
    store.write(APPEARANCE_SETTINGS.colorMode, "light");
    const theme = within(await canvas.findByRole("radiogroup", { name: "Theme" }));
    await expect(theme.getByRole("radio", { name: "Paper" })).toBeChecked();
    await userEvent.click(theme.getByRole("radio", { name: "Neutral" }));
    await expect(store.read(APPEARANCE_SETTINGS.lightTheme)).toBe("neutral");
    await expect(store.read(APPEARANCE_SETTINGS.darkTheme)).toBe("ink");
  },
};

/** A stored Theme that the picker cannot offer shows the Theme the engine falls back to. */
export const AThemeThePickerLacksShowsTheFallback: Story = {
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    store.writeAll(appearanceChanges({ lightTheme: "ink", darkTheme: "from-a-newer-app" }));
    const light = within(canvas.getByRole("radiogroup", { name: "Theme for light" }));
    const dark = within(canvas.getByRole("radiogroup", { name: "Theme for dark" }));
    await waitFor(() => expect(light.getByRole("radio", { name: "Neutral" })).toBeChecked());
    await expect(dark.getByRole("radio", { name: "Neutral" })).toBeChecked();
  },
};

export const FromThemeComesFirstAndNeedsAnAccentOfTheTheme: Story = {
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    const accent = canvas.getByRole("radiogroup", { name: "Accent" });
    await expect(namesIn(accent)).toEqual([
      "From Theme",
      "Blue",
      "Indigo",
      "Violet",
      "Teal",
      "Orange",
      "Grape",
    ]);

    // The Catalog shows light, and Neutral brings no Accent.
    const fromTheme = within(accent).getByRole("radio", { name: "From Theme" });
    await expect(fromTheme).toBeDisabled();
    await expect(fromTheme).toBeChecked();

    await userEvent.click(within(accent).getByRole("radio", { name: "Violet" }));
    await expect(within(accent).getByRole("radio", { name: "Violet" })).toBeChecked();
    await expect(store.read(APPEARANCE_SETTINGS.accent)).toBe("violet");
    await expect(shownRole(within(accent).getByRole("radio", { name: "Violet" }), "accent")).toBe(
      computed(COLOR_SETS.violet.light.accent),
    );

    const light = within(canvas.getByRole("radiogroup", { name: "Theme for light" }));
    await userEvent.click(light.getByRole("radio", { name: "Paper" }));
    await waitFor(() => expect(fromTheme).toBeEnabled());
    await expect(shownRole(fromTheme, "accent")).toBe(computed(COLOR_SETS.pink.light.accent));
    await userEvent.click(fromTheme);
    await expect(fromTheme).toBeChecked();
    await expect(store.read(APPEARANCE_SETTINGS.accent)).toBe("fromTheme");

    await userEvent.click(light.getByRole("radio", { name: "Neutral" }));
    await waitFor(() => expect(fromTheme).toBeDisabled());
  },
};

/** Paper has an Accent, but only for light, and Ink serves the dark that is on screen. */
export const FromThemeFollowsTheColorModeShown: Story = {
  globals: { colorMode: "dark" },
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    store.writeAll(appearanceChanges({ lightTheme: "paper", darkTheme: "ink" }));
    const accent = within(canvas.getByRole("radiogroup", { name: "Accent" }));
    await waitFor(() => expect(accent.getByRole("radio", { name: "From Theme" })).toBeDisabled());
    await expect(shownRole(accent.getByRole("radio", { name: "Teal" }), "accent")).toBe(
      computed(COLOR_SETS.teal.dark.accent),
    );
  },
};

/** One stop per picker for the Tab key; the arrows move inside and skip what cannot be chosen. */
export const WithTheKeyboard: Story = {
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    const light = within(canvas.getByRole("radiogroup", { name: "Theme for light" }));
    const dark = within(canvas.getByRole("radiogroup", { name: "Theme for dark" }));
    const accent = within(canvas.getByRole("radiogroup", { name: "Accent" }));

    await userEvent.tab();
    await expect(light.getByRole("radio", { name: "Neutral" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(light.getByRole("radio", { name: "Paper" })).toHaveFocus();
    await expect(store.read(APPEARANCE_SETTINGS.lightTheme)).toBe("paper");

    await userEvent.tab();
    await expect(dark.getByRole("radio", { name: "Neutral" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(dark.getByRole("radio", { name: "Ink" })).toHaveFocus();
    await expect(store.read(APPEARANCE_SETTINGS.darkTheme)).toBe("ink");

    await userEvent.tab();
    await expect(accent.getByRole("radio", { name: "From Theme" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(accent.getByRole("radio", { name: "Grape" })).toHaveFocus();
    await expect(store.read(APPEARANCE_SETTINGS.accent)).toBe("grape");

    // Back on Neutral, "From Theme" cannot be chosen, and the arrows pass it.
    store.write(APPEARANCE_SETTINGS.lightTheme, "neutral");
    await waitFor(() => expect(accent.getByRole("radio", { name: "From Theme" })).toBeDisabled());
    await userEvent.keyboard("{ArrowRight}");
    await expect(accent.getByRole("radio", { name: "Blue" })).toHaveFocus();
    await expect(store.read(APPEARANCE_SETTINGS.accent)).toBe("blue");
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radiogroup", { name: "Theme für Hell" })).toBeVisible();
    await expect(canvas.getByRole("radiogroup", { name: "Theme für Dunkel" })).toBeVisible();
    const accent = canvas.getByRole("radiogroup", { name: "Akzentfarbe" });
    await expect(namesIn(accent)).toEqual([
      "Vom Theme",
      "Blau",
      "Indigo",
      "Violett",
      "Petrol",
      "Orange",
      "Traube",
    ]);
  },
};
