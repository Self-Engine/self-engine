import type { Meta, StoryObj } from "@storybook/react-vite";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import type { PageCommand } from "@self-engine/shell";
import { expect, screen, spyOn, userEvent, waitFor } from "storybook/test";
import { settingsStore } from "./settings-store.ts";
import { AppAt, editInAddress, openPalette, paletteGone, storyRouter } from "./story-app.tsx";

const OVERVIEW = "/placeholder-alpha/overview";

const meta = {
  title: "App/Command palette",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  args: { address: OVERVIEW },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AViewCanBeReachedOnTheRealRouter: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole("button", { name: "New entry" });
    await openPalette();
    await userEvent.keyboard("archive{Enter}");
    await paletteGone();
    await expect(await canvas.findByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await expect(storyRouter().state.location.pathname).toBe("/placeholder-alpha/archive");
  },
};

const spyOnNewEntry = () => spyOn(alpha.commands![0] as { load: PageCommand["load"] }, "load");
let newEntry: ReturnType<typeof spyOnNewEntry>;

export const APageCommandStartsAndOpensItsDrawer: Story = {
  beforeEach: () => {
    newEntry = spyOnNewEntry();
    return () => newEntry.mockRestore();
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("button", { name: "New entry" });
    await openPalette();
    await userEvent.keyboard("new entry{Enter}");
    await paletteGone();
    await screen.findByRole("dialog", { name: "New entry" });
    await expect(newEntry).toHaveBeenCalledOnce();
    await waitFor(() => expect(editInAddress(storyRouter())).toBe("new"));
  },
};
