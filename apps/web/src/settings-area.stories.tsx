import { answersByMount } from "@self-engine/data-client/testing";
import {
  activateLanguage,
  type CatalogLoader,
  createI18n,
  type Language,
  loadAppCatalog,
} from "@self-engine/i18n";
import {
  APP_LANGUAGE_SETTING,
  APPEARANCE_SETTINGS,
  appearanceChanges,
  appLanguageOf,
} from "@self-engine/settings-area/settings";
import {
  createLocalSettingsAdapter,
  createSettingsStore,
  settingChange,
} from "@self-engine/settings";
import {
  type Appearance,
  BUILT_IN_THEMES,
  COLOR_SETS,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  roleVariable,
} from "@self-engine/theme";
import { FeedbackHost } from "@self-engine/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { AppLanguage } from "./app-language.tsx";
import { AppearanceProvider } from "./appearance.tsx";
import { settingsStore } from "./settings-store.ts";
import { loadStoryApp, AppAt, openPalette, paletteGone, storyRouter } from "./story-app.tsx";
import { placeholderAlphaAnswers } from "@self-engine/placeholder-alpha/testing";
import { backupAnswers } from "@self-engine/settings-area/testing";

const i18n = createI18n();
const APPEARANCE = "/settings/appearance";
const APPEARANCE_DENSITY = APPEARANCE_SETTINGS.density;
const LANGUAGE = "/settings/language";

/** What the browser would report; a story changes it and sends `languagechange`. */
let systemLanguages: readonly string[] = ["en-US"];
/** The language the app starts in, resolved as `main.tsx` does. */
let startLanguage: Language = "en";

const currentSystemLanguages = () => systemLanguages;

const germanFailsToLoad: CatalogLoader = async (language) => {
  if (language === "de") throw new Error("The German catalog is out of reach");
  return loadAppCatalog(language);
};

const resetSettings = () =>
  settingsStore.writeAll([
    ...appearanceChanges(DEFAULT_APPEARANCE),
    settingChange(APP_LANGUAGE_SETTING, APP_LANGUAGE_SETTING.default),
  ]);

/**
 * What the Port answers while the settings are shown: the rows of `placeholder-alpha`, and the
 * Backups, whose rows the View Data and a search show.
 */
const settingsAnswers = () =>
  answersByMount({ placeholderAlpha: placeholderAlphaAnswers(), backups: backupAnswers() });

const meta = {
  title: "App/Settings area",
  component: AppAt,
  // The app's own provider draws the appearance here, as in `main.tsx`, so that a row's effect on
  // the whole app can be seen. The Component Catalog then leaves its own provider out.
  parameters: { layout: "fullscreen", appearance: "app" },
  loaders: [
    // The start of `main.tsx`: load the store, resolve the stored language, show nothing before
    // its catalog is there.
    async ({ parameters }) => {
      await loadStoryApp();
      systemLanguages = ["en-US"];
      const stored = parameters["storedLanguage"] as string | undefined;
      if (stored !== undefined) settingsStore.write(APP_LANGUAGE_SETTING, stored);
      startLanguage = appLanguageOf(settingsStore, systemLanguages);
      await activateLanguage(i18n, startLanguage);
    },
  ],
  decorators: [
    (Story, { parameters }) => (
      <AppLanguage
        i18n={i18n}
        initialLanguage={startLanguage}
        loadCatalog={parameters["germanFailsToLoad"] === true ? germanFailsToLoad : loadAppCatalog}
        store={settingsStore}
        systemLanguages={currentSystemLanguages}
      >
        <AppearanceProvider>
          <FeedbackHost>
            <Story />
          </FeedbackHost>
        </AppearanceProvider>
      </AppLanguage>
    ),
  ],
  // The store is the app's one, on the browser's storage, which the next story shares.
  beforeEach: () => resetSettings,
  args: { address: APPEARANCE, access: settingsAnswers() },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

async function expectAppearanceView(canvas: ReturnType<typeof within>) {
  await expect(await canvas.findByRole("heading", { name: "Appearance", level: 1 })).toBeVisible();
  await expect(await canvas.findByRole("radiogroup", { name: "Color Mode" })).toBeVisible();
  await expect(storyRouter().state.location.pathname).toBe(APPEARANCE);
}

export const OpensOnAppearanceFromTheNavbar: Story = {
  args: { address: "/placeholder-beta/overview" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("link", { name: "Settings" }));
    await expectAppearanceView(canvas);
    await expect(canvas.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("radiogroup", { name: "Density" })).toBeVisible();
    await expect(canvas.getByRole("switch", { name: "Background Tint" })).toBeChecked();
    await expect(canvas.getByRole("slider", { name: "Font scale" })).toBeVisible();
  },
};

export const ThePaletteJumpsToAppearance: Story = {
  args: { address: "/placeholder-beta/overview" },
  play: async ({ canvas }) => {
    await canvas.findByText("The minimal module View.");
    await openPalette();
    await userEvent.keyboard("appearance{Enter}");
    await paletteGone();
    await expectAppearanceView(canvas);
  },
};

const root = () => document.documentElement;
const rootVariable = (name: string) => getComputedStyle(root()).getPropertyValue(name).trim();
/** The app's outermost background in the dark Color Mode, as the engine resolves it. */
const darkChromeOf = (appearance: Partial<Appearance>) =>
  resolveAppearance({ ...DEFAULT_APPEARANCE, ...appearance }, BUILT_IN_THEMES).dark.roles.chrome;

/** What the theme provider above the router made of each change, read from the document. */
export const EveryRowChangesTheAppearanceAtOnce: Story = {
  play: async ({ canvas }) => {
    await expectAppearanceView(canvas);

    await userEvent.click(canvas.getByRole("radio", { name: "Light" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-mantine-color-scheme", "light"));
    await userEvent.click(canvas.getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-mantine-color-scheme", "dark"));

    await expect(root()).toHaveAttribute("data-density", "comfortable");
    await userEvent.click(canvas.getByRole("radio", { name: "Compact" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-density", "compact"));

    const tinted = darkChromeOf({ backgroundTint: true });
    const neutral = darkChromeOf({ backgroundTint: false });
    await expect(tinted).not.toBe(neutral);
    await expect(rootVariable(roleVariable("chrome"))).toBe(tinted);
    await userEvent.click(canvas.getByRole("switch", { name: "Background Tint" }));
    await waitFor(() => expect(rootVariable(roleVariable("chrome"))).toBe(neutral));

    await expect(rootVariable("--mantine-scale")).toBe("1");
    canvas.getByRole("slider", { name: "Font scale" }).focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(rootVariable("--mantine-scale")).toBe("1.125"));
  },
};

export const TheThemePickersFollowTheColorMode: Story = {
  play: async ({ canvas }) => {
    await expectAppearanceView(canvas);
    const pickers = () =>
      canvas
        .getAllByRole("radiogroup", { name: /^Theme/ })
        .map((picker) => picker.getAttribute("aria-labelledby"))
        .map((id) => document.getElementById(id ?? "")?.textContent);

    // The default follows the system.
    await expect(pickers()).toEqual(["Theme for light", "Theme for dark"]);
    await userEvent.click(canvas.getByRole("radio", { name: "Light" }));
    await expect(pickers()).toEqual(["Theme"]);
    await userEvent.click(canvas.getByRole("radio", { name: "Dark" }));
    await expect(pickers()).toEqual(["Theme"]);
    await userEvent.click(canvas.getByRole("radio", { name: "System" }));
    await expect(pickers()).toEqual(["Theme for light", "Theme for dark"]);
  },
};

/** A second store on the browser's storage, as the next start of the app has one. */
async function restartedStore() {
  const browser = { getStorage: () => localStorage, getEvents: () => window };
  const store = createSettingsStore({
    adapters: {
      synced: createLocalSettingsAdapter(browser, "synced"),
      device: createLocalSettingsAdapter(browser, "device"),
    },
    onError: ({ error }) => {
      throw error;
    },
  });
  await store.load();
  return store;
}

export const AThemeCardAndAnAccentChangeTheAppAtOnce: Story = {
  play: async ({ canvas }) => {
    await expectAppearanceView(canvas);
    await userEvent.click(canvas.getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-mantine-color-scheme", "dark"));
    await expect(rootVariable(roleVariable("canvas"))).toBe("#141416");

    // The one picker of a fixed Color Mode writes the Theme of that mode.
    const theme = within(canvas.getByRole("radiogroup", { name: "Theme" }));
    await userEvent.click(theme.getByRole("radio", { name: "Warm" }));
    await waitFor(() => expect(rootVariable(roleVariable("canvas"))).toBe("#171412"));
    await expect(settingsStore.read(APPEARANCE_SETTINGS.lightTheme)).toBe("neutral");

    const accent = within(canvas.getByRole("radiogroup", { name: "Accent" }));
    // No built-in Theme brings an Accent of its own.
    await expect(accent.getByRole("radio", { name: "From Theme" })).toBeDisabled();
    await userEvent.click(accent.getByRole("radio", { name: "Violet" }));
    await waitFor(() =>
      expect(rootVariable(roleVariable("accent"))).toBe(COLOR_SETS.violet.dark.accent),
    );

    await waitFor(async () => {
      const restarted = await restartedStore();
      await expect(restarted.read(APPEARANCE_SETTINGS.darkTheme)).toBe("warm");
      await expect(restarted.read(APPEARANCE_SETTINGS.accent)).toBe("violet");
    });
  },
};

/**
 * No Theme the app ships brings an Accent of its own, and a stored Theme this version lacks is
 * served by the default Theme, as the engine draws it.
 */
export const FromThemeIsDisabledForAThemeWithoutAnAccent: Story = {
  play: async ({ canvas }) => {
    await expectAppearanceView(canvas);
    await userEvent.click(canvas.getByRole("radio", { name: "Light" }));
    const theme = within(await canvas.findByRole("radiogroup", { name: "Theme" }));
    const accent = within(canvas.getByRole("radiogroup", { name: "Accent" }));
    const fromTheme = accent.getByRole("radio", { name: "From Theme" });
    await expect(fromTheme).toBeChecked();

    for (const name of ["Neutral", "Warm", "Cool"]) {
      // oxlint-disable-next-line no-await-in-loop -- one Theme after the other, as a user picks
      await userEvent.click(theme.getByRole("radio", { name }));
      // oxlint-disable-next-line no-await-in-loop
      await waitFor(() => expect(theme.getByRole("radio", { name })).toBeChecked());
      // oxlint-disable-next-line no-await-in-loop
      await expect(fromTheme).toBeDisabled();
    }

    settingsStore.write(APPEARANCE_SETTINGS.lightTheme, "from-a-newer-app");
    await waitFor(() => expect(theme.getByRole("radio", { name: "Neutral" })).toBeChecked());
    await expect(rootVariable(roleVariable("canvas"))).toBe("#ffffff");
    await expect(fromTheme).toBeDisabled();

    // A choice that cannot be made changes nothing.
    await userEvent.click(accent.getByRole("radio", { name: "Violet" }));
    await userEvent.click(fromTheme, { pointerEventsCheck: 0 });
    await expect(settingsStore.read(APPEARANCE_SETTINGS.accent)).toBe("violet");
    await expect(settingsStore.read(APPEARANCE_SETTINGS.lightTheme)).toBe("from-a-newer-app");
  },
};

async function expectGermanAppearance(canvas: ReturnType<typeof within>) {
  await expect(await canvas.findByRole("heading", { name: "Darstellung", level: 1 })).toBeVisible();
  await expect(await canvas.findByRole("radiogroup", { name: "Farbmodus" })).toBeVisible();
  await expect(canvas.getByRole("radio", { name: "Dunkel" })).toBeInTheDocument();
  await expect(canvas.getByRole("radiogroup", { name: "Dichte" })).toBeVisible();
  await expect(canvas.getByRole("radio", { name: "Kompakt" })).toBeInTheDocument();
  await expect(canvas.getByRole("switch", { name: "Hintergrundtönung" })).toBeChecked();
  await expect(canvas.getByRole("slider", { name: "Schriftgröße" })).toHaveAttribute(
    "aria-valuetext",
    "100 %",
  );
}

async function expectLanguageView(canvas: ReturnType<typeof within>) {
  await expect(await canvas.findByRole("heading", { name: "Language", level: 1 })).toBeVisible();
  await expect(await canvas.findByRole("radiogroup", { name: "App Language" })).toBeVisible();
}

const germanShell = (canvas: ReturnType<typeof within>) =>
  canvas.findByRole("link", { name: "Einstellungen" });

export const ThePaletteJumpsToLanguage: Story = {
  args: { address: "/placeholder-beta/overview" },
  play: async ({ canvas }) => {
    await canvas.findByText("The minimal module View.");
    await openPalette();
    await userEvent.keyboard("language{Enter}");
    await paletteGone();
    await expectLanguageView(canvas);
    await expect(storyRouter().state.location.pathname).toBe(LANGUAGE);
  },
};

/** The picker only writes the Setting; the whole app follows without a reload. */
export const ChoosingALanguageChangesTheWholeApp: Story = {
  args: { address: LANGUAGE },
  play: async ({ canvas }) => {
    await expectLanguageView(canvas);
    await userEvent.click(canvas.getByRole("radio", { name: "Deutsch" }));

    await expect(await canvas.findByRole("heading", { name: "Sprache", level: 1 })).toBeVisible();
    await expect(canvas.getByRole("radiogroup", { name: "App-Sprache" })).toBeVisible();
    await expect(await germanShell(canvas)).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("link", { name: "Platzhalter Beta" })).toBeVisible();
    await expect(document.documentElement.lang).toBe("de");
    await expect(settingsStore.read(APP_LANGUAGE_SETTING)).toBe("de");
    await expect(storyRouter().state.location.pathname).toBe(LANGUAGE);

    await userEvent.click(canvas.getByRole("link", { name: "Darstellung" }));
    await expectGermanAppearance(canvas);

    await userEvent.click(canvas.getByRole("link", { name: "Sprache" }));
    await userEvent.click(await canvas.findByRole("radio", { name: "English" }));
    await expectLanguageView(canvas);
    await expect(document.documentElement.lang).toBe("en");
  },
};

/** Nothing renders before the stored language's catalog is there, as at the start of the app. */
export const StartsInTheStoredLanguage: Story = {
  args: { address: LANGUAGE },
  parameters: { storedLanguage: "de" },
  play: async ({ canvas }) => {
    await expect(startLanguage).toBe("de");
    await expect(await canvas.findByRole("heading", { name: "Sprache", level: 1 })).toBeVisible();
    await expect(await canvas.findByRole("radio", { name: "Deutsch" })).toBeChecked();
    await expect(canvas.queryByRole("link", { name: "Settings" })).toBeNull();
  },
};

/** As another tab or, later, sync would: the value changes in the store, nobody uses the picker. */
export const AValueWrittenFromOutsideSwitchesTheLanguage: Story = {
  play: async ({ canvas }) => {
    await expectAppearanceView(canvas);
    settingsStore.write(APP_LANGUAGE_SETTING, "de");
    await expectGermanAppearance(canvas);
    settingsStore.write(APP_LANGUAGE_SETTING, "system");
    await expectAppearanceView(canvas);
  },
};

export const ACatalogThatFailsToLoadLeavesTheLanguage: Story = {
  args: { address: LANGUAGE },
  parameters: { germanFailsToLoad: true },
  play: async ({ canvas }) => {
    await expectLanguageView(canvas);
    await userEvent.click(canvas.getByRole("radio", { name: "Deutsch" }));

    const notice = await screen.findByRole("alert");
    await expect(notice).toHaveTextContent("The language could not be loaded.");
    await expectLanguageView(canvas);
    await expect(canvas.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(document.documentElement.lang).toBe("en");
    // The choice is kept for the next start.
    await expect(settingsStore.read(APP_LANGUAGE_SETTING)).toBe("de");
    await userEvent.click(screen.getByRole("button", { name: "Close notice" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  },
};

/** A language of a newer app version follows the system and is not overwritten. */
export const AnUnknownStoredLanguageBehavesLikeSystem: Story = {
  args: { address: LANGUAGE },
  parameters: { storedLanguage: "fr" },
  play: async ({ canvas }) => {
    await expectLanguageView(canvas);
    await expect(canvas.getByRole("radio", { name: "System" })).toBeChecked();

    systemLanguages = ["de-DE", "en"];
    window.dispatchEvent(new Event("languagechange"));
    await expect(await canvas.findByRole("heading", { name: "Sprache", level: 1 })).toBeVisible();
    await expect(settingsStore.read(APP_LANGUAGE_SETTING)).toBe("fr");
  },
};

export const SystemFollowsTheBrowsersLanguageChange: Story = {
  play: async ({ canvas }) => {
    await expectAppearanceView(canvas);

    systemLanguages = ["de-DE", "en"];
    window.dispatchEvent(new Event("languagechange"));
    await expectGermanAppearance(canvas);

    systemLanguages = ["en-GB"];
    window.dispatchEvent(new Event("languagechange"));
    await expectAppearanceView(canvas);
  },
};

/** A chosen language stays when the system's changes. */
export const AChosenLanguageIgnoresTheSystem: Story = {
  parameters: { storedLanguage: "en" },
  play: async ({ canvas }) => {
    await expectAppearanceView(canvas);
    systemLanguages = ["de-DE"];
    window.dispatchEvent(new Event("languagechange"));
    // The other story shows that the event is followed; here nothing may change.
    settingsStore.write(APPEARANCE_DENSITY, "compact");
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-density", "compact"),
    );
    await expectAppearanceView(canvas);
    await expect(document.documentElement.lang).toBe("en");
  },
};
