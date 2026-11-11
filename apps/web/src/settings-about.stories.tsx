import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, spyOn, userEvent, within } from "storybook/test";
import { version } from "../package.json";
import { loadStoryApp, AppAt, openPalette, paletteGone, storyRouter } from "./story-app.tsx";

const ABOUT = "/settings/about";

// The Catalog runs in a browser, so the app in these stories is the web app: the version is the
// one the build inserted, and there is no channel. The desktop app's About is a story of the
// settings area itself.
const meta = {
  title: "App/Settings area/About",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [loadStoryApp],
  args: { address: ABOUT },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

async function expectAboutView(canvas: ReturnType<typeof within>) {
  await expect(await canvas.findByRole("heading", { name: "About", level: 1 })).toBeVisible();
  await expect(await canvas.findByText("Operating system")).toBeVisible();
  await expect(storyRouter().state.location.pathname).toBe(ABOUT);
}

export const ShowsTheVersionTheBuildInserted: Story = {
  play: async ({ canvas }) => {
    await expectAboutView(canvas);
    await expect(version).toMatch(/^\d+\.\d+\.\d+/);
    await expect(canvas.getByText(version)).toBeVisible();
    await expect(canvas.getByText("AGPL-3.0-only")).toBeVisible();
    await expect(canvas.queryByText("Channel")).toBeNull();
  },
};

export const IsAViewOfTheSettings: Story = {
  args: { address: "/settings/appearance" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("link", { name: "About" }));
    await expectAboutView(canvas);
  },
};

export const ThePaletteJumpsToAbout: Story = {
  args: { address: "/placeholder-beta/overview" },
  play: async ({ canvas }) => {
    await canvas.findByText("The minimal module View.");
    await openPalette();
    await userEvent.keyboard("about{Enter}");
    await paletteGone();
    await expectAboutView(canvas);
  },
};

export const CopiesTheLineForABugReport: Story = {
  play: async ({ canvas }) => {
    await expectAboutView(canvas);
    // The clipboard of the test browser is not the user's, so the story takes its place.
    const written = spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
      await expect(written).toHaveBeenCalledOnce();
      await expect(written.mock.calls[0]?.[0]).toMatch(
        new RegExp(`^Self-Engine ${version.replaceAll(".", "\\.")}, \\S`),
      );
      await expect(await canvas.findByRole("button", { name: "Copied" })).toBeVisible();
    } finally {
      written.mockRestore();
    }
  },
};
