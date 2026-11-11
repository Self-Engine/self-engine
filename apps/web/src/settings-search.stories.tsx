import { APPEARANCE_SETTINGS, appearanceChanges } from "@self-engine/settings-area/settings";
import { DEFAULT_APPEARANCE } from "@self-engine/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { settingsStore } from "./settings-store.ts";
import { AppAt, storyRouter } from "./story-app.tsx";

const APPEARANCE = "/settings/appearance";
const LANGUAGE = "/settings/language";

// The search on the real router: its text is a search parameter of the address, which the Views
// of the settings share.
const meta = {
  title: "App/Settings area/Search",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  // The store is the app's one, on the browser's storage, which the next story shares.
  beforeEach: () => () => settingsStore.writeAll(appearanceChanges(DEFAULT_APPEARANCE)),
  args: { address: APPEARANCE },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

const field = (canvas: Canvas) => canvas.findByRole("searchbox", { name: "Search settings" });
const hitsOf = async (canvas: Canvas, view: string) =>
  within(await canvas.findByRole("region", { name: view }));
const location = () => storyRouter().state.location;
/** The search text of the address, once the router has caught up with the typing. */
const addressHas = (text: string | undefined) =>
  waitFor(() => expect((location().search as { readonly q?: unknown }).q).toBe(text));

async function expectViewOfTheAddress(canvas: Canvas, title: string) {
  await expect(await canvas.findByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(canvas.getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
}

async function expectFieldAboveTheRows(canvas: Canvas, view: string, firstRow: string) {
  await userEvent.click(await canvas.findByRole("link", { name: view }));
  await expectViewOfTheAddress(canvas, view);
  const row = await canvas.findByText(firstRow);
  const search = await field(canvas);
  await expect(search).toBeVisible();
  await expect(search.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

export const EveryViewHasTheFieldAboveItsRows: Story = {
  play: async ({ canvas }) => {
    await expectFieldAboveTheRows(canvas, "Appearance", "Color Mode");
    await expectFieldAboveTheRows(canvas, "Language", "App Language");
    await expectFieldAboveTheRows(canvas, "About", "Version");
  },
};

/** The Shell is as it was: it still marks and names the View of the address. */
export const TypingShowsRowsOfOtherViewsAndWritesTheAddress: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(await field(canvas), "license");
    await expect((await hitsOf(canvas, "About")).getByText("AGPL-3.0-only")).toBeVisible();
    await expect(canvas.queryByRole("radiogroup", { name: "Color Mode" })).toBeNull();
    await addressHas("license");
    await expect(location().pathname).toBe(APPEARANCE);
    await expectViewOfTheAddress(canvas, "Appearance");
  },
};

export const AControlInTheHitListChangesItsSetting: Story = {
  args: { address: LANGUAGE },
  play: async ({ canvas }) => {
    await userEvent.type(await field(canvas), "compact");
    const appearance = await hitsOf(canvas, "Appearance");
    await userEvent.click(appearance.getByRole("radio", { name: "Compact" }));
    await expect(appearance.getByRole("radio", { name: "Compact" })).toBeChecked();
    await expect(settingsStore.read(APPEARANCE_SETTINGS.density)).toBe("compact");
    await expectViewOfTheAddress(canvas, "Language");
  },
};

/** What a reload does: the app starts at an address that already holds a search text. */
export const AnAddressWithASearchTextShowsItsHits: Story = {
  args: { address: `${LANGUAGE}?q=compact` },
  play: async ({ canvas }) => {
    await expect(await field(canvas)).toHaveValue("compact");
    await expect(
      (await hitsOf(canvas, "Appearance")).getByRole("radiogroup", { name: "Density" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("radiogroup", { name: "App Language" })).toBeNull();
    await expectViewOfTheAddress(canvas, "Language");
  },
};

export const TheSearchTextStaysWhenTheViewChanges: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(await field(canvas), "compact");
    await addressHas("compact");

    await userEvent.click(canvas.getByRole("link", { name: "Language" }));
    await expectViewOfTheAddress(canvas, "Language");
    await expect(location().pathname).toBe(LANGUAGE);
    await addressHas("compact");
    await expect(await field(canvas)).toHaveValue("compact");
    await expect(
      (await hitsOf(canvas, "Appearance")).getByRole("radiogroup", { name: "Density" }),
    ).toBeVisible();
  },
};

export const ClearingTheFieldShowsTheViewOfTheAddress: Story = {
  args: { address: `${LANGUAGE}?q=compact` },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Clear search" }));
    await expect(await canvas.findByRole("radiogroup", { name: "App Language" })).toBeVisible();
    await expect(canvas.queryByRole("region")).toBeNull();
    await expect(await field(canvas)).toHaveValue("");
    await addressHas(undefined);
    await expect(location().pathname).toBe(LANGUAGE);
  },
};

export const BackBringsTheSearchBack: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(await field(canvas), "license");
    await addressHas("license");

    // Another module does not share the parameter.
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await canvas.findByText("The minimal module View.");
    await addressHas(undefined);

    storyRouter().history.back();
    await expect(await field(canvas)).toHaveValue("license");
    await expect((await hitsOf(canvas, "About")).getByText("AGPL-3.0-only")).toBeVisible();
    await addressHas("license");

    // Back within the settings takes the field along, here to the text one key press earlier.
    storyRouter().history.back();
    await waitFor(async () => expect(await field(canvas)).toHaveValue("licens"));
    await addressHas("licens");
  },
};

/** The router reads `?q=404` as a number; the search still takes it as the text that was typed. */
export const ATextWithoutAMatchShowsTheEmptyState: Story = {
  args: { address: `${APPEARANCE}?q=404` },
  play: async ({ canvas }) => {
    await expect(await field(canvas)).toHaveValue("404");
    await expect(await canvas.findByText("No settings found")).toBeVisible();
    await expect(canvas.queryByRole("radiogroup")).toBeNull();
    await expectViewOfTheAddress(canvas, "Appearance");

    await userEvent.type(await field(canvas), "x");
    await addressHas("404x");
    await expect(canvas.getByText("No settings found")).toBeVisible();
  },
};
