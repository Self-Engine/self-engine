import type { LocalSettingsStorage, SettingsStore } from "@self-engine/settings";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { createSettingsArea } from "./index.ts";
import { APP_LANGUAGE_SETTING } from "./settings.ts";
import { loadedStoreOn, memoryStorage } from "./story-store.ts";

interface Loaded {
  readonly storage: LocalSettingsStorage;
  readonly store: SettingsStore;
  readonly Page: ComponentType;
}

/**
 * The row alone: it only writes the Setting. That the app then changes its language is the app's
 * watcher, and the app's stories show it.
 */
const meta = {
  title: "Settings area/Language",
  loaders: [
    async ({ parameters }): Promise<Loaded> => {
      const storage = memoryStorage();
      const store = await loadedStoreOn(storage);
      const stored = parameters["storedLanguage"] as string | undefined;
      if (stored !== undefined) store.write(APP_LANGUAGE_SETTING, stored);
      const language = createSettingsArea({ store }).views.find((view) => view.id === "language");
      if (language === undefined) throw new Error("The settings area has no View Language");
      return { storage, store, Page: (await language.load()).default };
    },
  ],
  render: (_args, { loaded }) => {
    const { Page } = loaded as Loaded;
    return <Page />;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const choices = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll(".mantine-SegmentedControl-label")].map(
    (label) => label.textContent,
  );

export const SystemAndTheLanguages: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("radiogroup", { name: "App Language" })).toBeVisible();
    await expect(choices(canvasElement)).toEqual(["System", "Deutsch", "English"]);
    await expect(canvas.getByRole("radio", { name: "System" })).toBeChecked();
  },
};

/** Each language keeps its own name, so that someone finds theirs after a wrong choice. */
export const InGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("radiogroup", { name: "App-Sprache" })).toBeVisible();
    await expect(choices(canvasElement)).toEqual(["System", "Deutsch", "English"]);
    await expect(
      canvas.getByText(
        "Die Sprache, in der die App angezeigt wird. „System“ folgt der Sprache dieses Geräts.",
      ),
    ).toBeVisible();
  },
};

/** With the keyboard alone, and what the row wrote is there for the next start. */
export const KeyboardAndRestart: Story = {
  play: async ({ canvas, loaded }) => {
    const { storage, store } = loaded as Loaded;
    const system = canvas.getByRole("radio", { name: "System" });

    await userEvent.tab();
    await expect(system).toHaveFocus();
    await expect(system.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", { name: "Deutsch" })).toBeChecked();

    await expect(store.read(APP_LANGUAGE_SETTING)).toBe("de");
    await waitFor(async () => {
      const restarted = await loadedStoreOn(storage);
      await expect(restarted.read(APP_LANGUAGE_SETTING)).toBe("de");
    });
  },
};

/** A language of a newer app version: shown as "System", which is how it behaves, and kept. */
export const AnUnknownStoredLanguage: Story = {
  parameters: { storedLanguage: "fr" },
  play: async ({ canvas, loaded }) => {
    const { storage, store } = loaded as Loaded;
    await expect(canvas.getByRole("radio", { name: "System" })).toBeChecked();
    await expect(store.read(APP_LANGUAGE_SETTING)).toBe("fr");
    await waitFor(async () => {
      await expect((await loadedStoreOn(storage)).read(APP_LANGUAGE_SETTING)).toBe("fr");
    });

    await userEvent.click(canvas.getByRole("radio", { name: "English" }));
    await expect(store.read(APP_LANGUAGE_SETTING)).toBe("en");
  },
};
