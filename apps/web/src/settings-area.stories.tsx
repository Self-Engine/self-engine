import { activateLanguage, createI18n } from "@self-engine/i18n";
import { appearanceChanges } from "@self-engine/settings-area/settings";
import {
  type Appearance,
  BUILT_IN_THEMES,
  DEFAULT_APPEARANCE,
  resolveAppearance,
  roleVariable,
} from "@self-engine/theme";
import { FeedbackHost } from "@self-engine/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AppearanceProvider } from "./appearance.tsx";
import { PreviewLanguage } from "./preview-language.tsx";
import { settingsStore } from "./settings-store.ts";
import { AppAt, openPalette, paletteGone, storyRouter } from "./story-app.tsx";

const i18n = createI18n();
const APPEARANCE = "/settings/appearance";

const resetAppearance = () => settingsStore.writeAll(appearanceChanges(DEFAULT_APPEARANCE));

const meta = {
  title: "App/Settings area",
  component: AppAt,
  // The app's own provider draws the appearance here, as in `main.tsx`, so that a row's effect on
  // the whole app can be seen. The Component Catalog then leaves its own provider out.
  parameters: { layout: "fullscreen", appearance: "app" },
  loaders: [
    async () => {
      await settingsStore.load();
      await activateLanguage(i18n, "en");
    },
  ],
  decorators: [
    (Story) => (
      <PreviewLanguage i18n={i18n} initialLanguage="en">
        <AppearanceProvider>
          <FeedbackHost>
            <Story />
          </FeedbackHost>
        </AppearanceProvider>
      </PreviewLanguage>
    ),
  ],
  // The store is the app's one, on the browser's storage, which the next story shares.
  beforeEach: () => {
    resetAppearance();
    return resetAppearance;
  },
  args: { address: APPEARANCE },
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

export const TextsFollowALanguageSwitch: Story = {
  args: { address: "/settings/language-sample" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("radio", { name: "Deutsch" }));
    await userEvent.click(await canvas.findByRole("link", { name: "Darstellung" }));
    await expect(
      await canvas.findByRole("heading", { name: "Darstellung", level: 1 }),
    ).toBeVisible();
    await expect(await canvas.findByRole("radiogroup", { name: "Farbmodus" })).toBeVisible();
    await expect(canvas.getByRole("radio", { name: "Dunkel" })).toBeInTheDocument();
    await expect(canvas.getByRole("radiogroup", { name: "Dichte" })).toBeVisible();
    await expect(canvas.getByRole("radio", { name: "Kompakt" })).toBeInTheDocument();
    await expect(canvas.getByRole("switch", { name: "Hintergrundtönung" })).toBeChecked();
    await expect(canvas.getByRole("slider", { name: "Schriftgröße" })).toHaveAttribute(
      "aria-valuetext",
      "100 %",
    );
  },
};
