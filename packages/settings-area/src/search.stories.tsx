import type { SettingsStore } from "@self-engine/settings";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { SettingsRow } from "./index.ts";
import { APPEARANCE_SETTINGS } from "./settings.ts";
import { storyViewPage } from "./story-page.tsx";
import { loadedStoreOn, memoryStorage } from "./story-store.ts";

interface Loaded {
  readonly store: SettingsStore;
  readonly Page: ComponentType;
}

/**
 * The search on the page alone, with the text held by the story. That the text is in the address
 * is the app's stories.
 */
const meta = {
  title: "Settings area/Search",
  loaders: [
    async ({ parameters }): Promise<Loaded> => {
      const store = await loadedStoreOn(memoryStorage());
      const rows = parameters["rows"] as readonly SettingsRow[] | undefined;
      return { store, Page: storyViewPage("appearance", { store, ...(rows && { rows }) }) };
    },
  ],
  render: (_args, { loaded }) => {
    const { Page } = loaded as Loaded;
    return <Page />;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

const field = (canvas: Canvas, name = "Search settings") => canvas.getByRole("searchbox", { name });

/** The hits of one View, under its title. */
const hitsOf = (canvas: Canvas, view: string) => within(canvas.getByRole("region", { name: view }));

export const TheFieldStandsAboveTheRowsOfTheView: Story = {
  play: async ({ canvas }) => {
    const search = field(canvas);
    const colorMode = canvas.getByRole("radiogroup", { name: "Color Mode" });
    await expect(search).toBeVisible();
    await expect(search).toHaveValue("");
    await expect(
      search.compareDocumentPosition(colorMode) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The View has its title in the content header, so nothing repeats it here.
    await expect(canvas.queryByRole("region")).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Clear search" })).toBeNull();
  },
};

export const TypingShowsTheMatchingRowsOfAllViews: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(field(canvas), "system");
    // Both the Color Mode and the App Language offer "System"; About describes the operating system.
    await expect(
      hitsOf(canvas, "Appearance").getByRole("radiogroup", { name: "Color Mode" }),
    ).toBeVisible();
    await expect(
      hitsOf(canvas, "Language").getByRole("radiogroup", { name: "App Language" }),
    ).toBeVisible();
    await expect(hitsOf(canvas, "About").getByText("Operating system")).toBeVisible();
    await expect(canvas.queryByRole("radiogroup", { name: "Density" })).toBeNull();
  },
};

export const AValueFindsItsRowAndTheControlWorks: Story = {
  play: async ({ canvas, loaded }) => {
    const { store } = loaded as Loaded;
    await userEvent.type(field(canvas), "compact");
    const appearance = hitsOf(canvas, "Appearance");
    await expect(appearance.getByRole("radiogroup", { name: "Density" })).toBeVisible();
    await expect(canvas.queryByRole("radiogroup", { name: "Color Mode" })).toBeNull();
    await expect(canvas.getAllByRole("region")).toHaveLength(1);

    await userEvent.click(appearance.getByRole("radio", { name: "Compact" }));
    await expect(appearance.getByRole("radio", { name: "Compact" })).toBeChecked();
    await expect(store.read(APPEARANCE_SETTINGS.density)).toBe("compact");
  },
};

export const AboutValuesFindTheirRows: Story = {
  play: async ({ canvas }) => {
    for (const { value, title } of [
      { value: "macOS", title: "Operating system" },
      { value: "AGPL-3.0-only", title: "License" },
      { value: "0.0.1", title: "Version" },
    ]) {
      await userEvent.clear(field(canvas));
      await userEvent.type(field(canvas), value);
      const about = hitsOf(canvas, "About");
      await expect(about.getByText(title, { exact: true })).toBeVisible();
      await expect(about.getByText(value, { exact: true })).toBeVisible();
      await expect(canvas.getAllByRole("region")).toHaveLength(1);
    }
  },
};

export const AWordStartStandsBeforeAMatchInsideAWord: Story = {
  play: async ({ canvas }) => {
    // "te" starts "text" in the description of Density and stands inside "system" in that of the
    // Color Mode, which is first in the list.
    await userEvent.type(field(canvas), "te");
    const appearance = hitsOf(canvas, "Appearance");
    const density = appearance.getByRole("radiogroup", { name: "Density" });
    const colorMode = appearance.getByRole("radiogroup", { name: "Color Mode" });
    await expect(
      density.compareDocumentPosition(colorMode) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};

export const ClearingTheFieldShowsTheViewAgain: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(field(canvas), "license");
    await expect(canvas.queryByRole("radiogroup", { name: "Color Mode" })).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await expect(field(canvas)).toHaveValue("");
    await expect(field(canvas)).toHaveFocus();
    await expect(canvas.getByRole("radiogroup", { name: "Color Mode" })).toBeVisible();
    await expect(canvas.queryByRole("region")).toBeNull();

    await userEvent.type(field(canvas), "li");
    await userEvent.keyboard("{Backspace}{Backspace}");
    await expect(canvas.getByRole("radiogroup", { name: "Density" })).toBeVisible();
  },
};

export const ATextWithoutAMatchSaysSo: Story = {
  play: async ({ canvas }) => {
    // A typo finds nothing.
    await userEvent.type(field(canvas), "densty");
    await expect(canvas.getByText("No settings found")).toBeVisible();
    await expect(canvas.getByText("Try another word, or clear the search.")).toBeVisible();
    await expect(canvas.queryByRole("radiogroup")).toBeNull();
    await expect(field(canvas)).toHaveValue("densty");
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    const search = field(canvas, "Einstellungen durchsuchen");
    await userEvent.type(search, "kompakt");
    await expect(
      hitsOf(canvas, "Darstellung").getByRole("radiogroup", { name: "Dichte" }),
    ).toBeVisible();

    await userEvent.clear(search);
    await userEvent.type(search, "compact");
    await expect(canvas.getByText("Keine Einstellungen gefunden")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Suche leeren" }));
    await expect(canvas.getByRole("radiogroup", { name: "Farbmodus" })).toBeVisible();
  },
};

/** How often each row's control was drawn. */
const draws = new Map<string, number>();

const countedRow = (id: string, view: string, title: string): SettingsRow => ({
  id,
  view,
  title: { id: `story-${title}`, message: title },
  searchWords: [],
  values: [],
  control: function Counted() {
    draws.set(id, (draws.get(id) ?? 0) + 1);
    return null;
  },
});

/** A keystroke draws only the rows that appear: those that stay are left alone. */
export const TypingDoesNotDrawTheRowsThatStay: Story = {
  parameters: {
    rows: [
      countedRow("density", "appearance", "Density"),
      countedRow("font-scale", "appearance", "Font scale"),
      countedRow("license", "about", "License"),
    ],
  },
  beforeEach: () => {
    draws.clear();
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Density")).toBeVisible();
    const before = new Map(draws);
    await expect(before.get("license")).toBeUndefined();

    // "e" keeps Density and Font scale and brings License; "en" keeps Density and License.
    await userEvent.type(field(canvas), "e");
    await expect(canvas.getByText("License")).toBeVisible();
    const afterOne = new Map(draws);
    await userEvent.type(field(canvas), "n");
    await expect(canvas.queryByText("Font scale")).toBeNull();
    await userEvent.type(field(canvas), "s");

    await expect(canvas.getByText("Density")).toBeVisible();
    await expect(draws.get("density")).toBe(before.get("density"));
    await expect(afterOne.get("font-scale")).toBe(before.get("font-scale"));
    await expect(draws.get("license")).toBe(afterOne.get("license"));
  },
};
