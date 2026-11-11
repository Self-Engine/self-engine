import type { LocalSettingsStorage, SettingsStore } from "@self-engine/settings";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { createSettingsArea } from "./index.ts";
import { APPEARANCE_SETTINGS } from "./settings.ts";
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
      const [appearance] = createSettingsArea({ store }).views;
      return { storage, store, Page: (await appearance.load()).default };
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

export const FourRows: Story = {
  play: async ({ canvas, canvasElement }) => {
    const colorMode = canvas.getByRole("radiogroup", { name: "Color Mode" });
    await expect(colorMode).toBeVisible();
    await expect(canvas.getByRole("radio", { name: "System" })).toBeChecked();
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

    await tabTo(canvas.getByRole("radio", { name: "System" }));
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByRole("radio", { name: "Dark" })).toBeChecked();

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
      await expect(restarted.read(APPEARANCE_SETTINGS.density)).toBe("compact");
      await expect(restarted.read(APPEARANCE_SETTINGS.backgroundTint)).toBe(false);
      await expect(restarted.read(APPEARANCE_SETTINGS.fontScale)).toBe(87.5);
    });
  },
};
