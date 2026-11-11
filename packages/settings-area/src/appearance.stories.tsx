import type { LocalSettingsStorage, SettingsStore } from "@self-engine/settings";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { APPEARANCE_SETTINGS } from "./settings.ts";
import { storyViewPage } from "./story-page.tsx";
import { loadedStoreOn, memoryStorage } from "./story-store.ts";

interface Loaded {
  readonly storage: LocalSettingsStorage;
  readonly store: SettingsStore;
  readonly Page: ComponentType;
}

const meta = {
  title: "Settings area/Appearance",
  loaders: [
    async (): Promise<Loaded> => {
      const storage = memoryStorage();
      const store = await loadedStoreOn(storage);
      return { storage, store, Page: storyViewPage("appearance", { store }) };
    },
  ],
  render: (_args, { loaded }) => {
    const { Page } = loaded as Loaded;
    return <Page />;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const stopNames = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll(".mantine-Slider-markLabel")].map((mark) => mark.textContent);

export const SixRows: Story = {
  play: async ({ canvas, canvasElement }) => {
    const colorMode = canvas.getByRole("radiogroup", { name: "Color Mode" });
    await expect(colorMode).toBeVisible();
    await expect(canvas.getByRole("radio", { name: "System" })).toBeChecked();
    for (const picker of ["Theme for light", "Theme for dark"]) {
      const cards = within(canvas.getByRole("radiogroup", { name: picker }));
      await expect(cards.getByRole("radio", { name: "Neutral" })).toBeChecked();
      await expect(cards.getByRole("radio", { name: "Warm" })).toBeVisible();
      await expect(cards.getByRole("radio", { name: "Cool" })).toBeVisible();
    }
    const accent = within(canvas.getByRole("radiogroup", { name: "Accent" }));
    await expect(accent.getAllByRole("radio")).toHaveLength(7);
    await expect(accent.getByRole("radio", { name: "From Theme" })).toBeChecked();
    await expect(canvas.getByRole("radiogroup", { name: "Density" })).toBeVisible();
    await expect(canvas.getByRole("radio", { name: "Comfortable" })).toBeChecked();
    await expect(canvas.getByRole("switch", { name: "Background Tint" })).toBeChecked();
    const fontScale = canvas.getByRole("slider", { name: "Font scale" });
    await expect(fontScale).toHaveAttribute("aria-valuetext", "100%");
    await expect(stopNames(canvasElement)).toEqual([
      "87.5%",
      "93.75%",
      "100%",
      "106.25%",
      "112.5%",
    ]);
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas, canvasElement }) => {
    const colorMode = canvas.getByRole("radiogroup", { name: "Farbmodus" });
    await expect(colorMode).toBeVisible();
    for (const name of ["Hell", "Dunkel", "System", "Komfortabel", "Kompakt"]) {
      // The radio itself is hidden behind its label.
      await expect(canvas.getByRole("radio", { name })).toBeInTheDocument();
    }
    const light = within(canvas.getByRole("radiogroup", { name: "Theme für Hell" }));
    await expect(light.getByRole("radio", { name: "Kühl" })).toBeVisible();
    await expect(canvas.getByRole("radiogroup", { name: "Theme für Dunkel" })).toBeVisible();
    const accent = within(canvas.getByRole("radiogroup", { name: "Akzentfarbe" }));
    await expect(accent.getByRole("radio", { name: "Vom Theme" })).toBeChecked();
    await expect(accent.getByRole("radio", { name: "Violett" })).toBeVisible();
    await expect(canvas.getByRole("radiogroup", { name: "Dichte" })).toBeVisible();
    await expect(canvas.getByRole("switch", { name: "Hintergrundtönung" })).toBeChecked();
    await expect(canvas.getByRole("slider", { name: "Schriftgröße" })).toBeVisible();
    await expect(canvas.getByText("Wie groß der Text in der ganzen App ist.")).toBeVisible();
    // German puts a no-break space before the percent sign.
    await expect(stopNames(canvasElement)).toEqual([
      "87,5 %",
      "93,75 %",
      "100 %",
      "106,25 %",
      "112,5 %",
    ]);
  },
};

async function tabTo(control: HTMLElement) {
  await userEvent.tab();
  await expect(control).toHaveFocus();
  // The ring only shows for the keyboard, which is what this pseudo-class says.
  await expect(control.matches(":focus-visible")).toBe(true);
}

/** Every row with the keyboard alone, and what it wrote is there for the next start. */
export const KeyboardAndRestart: Story = {
  play: async ({ canvas, loaded }) => {
    const { storage, store } = loaded as Loaded;

    await tabTo(canvas.getByRole("searchbox", { name: "Search settings" }));
    await tabTo(canvas.getByRole("radio", { name: "System" }));
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByRole("radio", { name: "Dark" })).toBeChecked();

    // Dark is a fixed Color Mode, so there is one picker, and it writes the dark Theme.
    const theme = within(await canvas.findByRole("radiogroup", { name: "Theme" }));
    await tabTo(theme.getByRole("radio", { name: "Neutral" }));
    await userEvent.keyboard("{ArrowRight}");
    await expect(theme.getByRole("radio", { name: "Warm" })).toBeChecked();

    // No built-in Theme brings an Accent, so the Tab key stops on the first one that can be chosen.
    const accent = within(canvas.getByRole("radiogroup", { name: "Accent" }));
    await tabTo(accent.getByRole("radio", { name: "Blue" }));
    await userEvent.keyboard("{ArrowRight}");
    await expect(accent.getByRole("radio", { name: "Indigo" })).toBeChecked();

    await tabTo(canvas.getByRole("radio", { name: "Comfortable" }));
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", { name: "Compact" })).toBeChecked();

    const tint = canvas.getByRole("switch", { name: "Background Tint" });
    await tabTo(tint);
    await userEvent.keyboard(" ");
    await expect(tint).not.toBeChecked();

    const fontScale = canvas.getByRole("slider", { name: "Font scale" });
    await tabTo(fontScale);
    await userEvent.keyboard("{ArrowRight}");
    await expect(fontScale).toHaveAttribute("aria-valuenow", "106.25");
    await userEvent.keyboard("{End}");
    await expect(fontScale).toHaveAttribute("aria-valuenow", "112.5");
    await userEvent.keyboard("{Home}");
    await expect(fontScale).toHaveAttribute("aria-valuenow", "87.5");

    await expect(store.read(APPEARANCE_SETTINGS.colorMode)).toBe("dark");
    await waitFor(async () => {
      const restarted = await loadedStoreOn(storage);
      await expect(restarted.read(APPEARANCE_SETTINGS.colorMode)).toBe("dark");
      await expect(restarted.read(APPEARANCE_SETTINGS.darkTheme)).toBe("warm");
      await expect(restarted.read(APPEARANCE_SETTINGS.lightTheme)).toBe("neutral");
      await expect(restarted.read(APPEARANCE_SETTINGS.accent)).toBe("indigo");
      await expect(restarted.read(APPEARANCE_SETTINGS.density)).toBe("compact");
      await expect(restarted.read(APPEARANCE_SETTINGS.backgroundTint)).toBe(false);
      await expect(restarted.read(APPEARANCE_SETTINGS.fontScale)).toBe(87.5);
    });
  },
};
