import { createSettingsStore } from "@self-engine/settings";
import { createTestAdapter } from "@self-engine/settings/testing";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, spyOn, userEvent } from "storybook/test";
import type { VersionInfo } from "./index.ts";
import { storyViewPage } from "./story-page.tsx";

const NIGHTLY: VersionInfo = {
  version: "0.4.0-nightly.20261112.3",
  channel: "nightly",
  operatingSystem: "macOS",
};
const WEB: VersionInfo = { version: "0.4.0", operatingSystem: "Windows" };

/** The page of About for an app that is `version`. */
const aboutOf = (version: VersionInfo) => async (): Promise<{ readonly Page: ComponentType }> => {
  const store = createSettingsStore({
    adapters: { synced: createTestAdapter(), device: createTestAdapter() },
    onError: ({ error }) => {
      throw error;
    },
  });
  return { Page: storyViewPage("about", { store, version }) };
};

const meta = {
  title: "Settings area/About",
  loaders: [aboutOf(NIGHTLY)],
  render: (_args, { loaded }) => {
    const { Page } = loaded as { readonly Page: ComponentType };
    return <Page />;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const InTheDesktopApp: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Version")).toBeVisible();
    await expect(canvas.getByText("0.4.0-nightly.20261112.3")).toBeVisible();
    await expect(canvas.getByText("Channel")).toBeVisible();
    await expect(canvas.getByText("Nightly")).toBeVisible();
    await expect(canvas.getByText("Operating system")).toBeVisible();
    await expect(canvas.getByText("macOS")).toBeVisible();
    await expect(canvas.getByText("License")).toBeVisible();
    await expect(canvas.getByText("AGPL-3.0-only")).toBeVisible();
  },
};

export const OnTheWebThereIsNoChannel: Story = {
  loaders: [aboutOf(WEB)],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("0.4.0")).toBeVisible();
    await expect(canvas.getByText("Windows")).toBeVisible();
    await expect(canvas.getByText("AGPL-3.0-only")).toBeVisible();
    await expect(canvas.queryByText("Channel")).toBeNull();
  },
};

/** A desktop app whose bridge carried no version says so and invents no number. */
export const WithoutAKnownVersion: Story = {
  loaders: [aboutOf({ channel: "nightly", operatingSystem: "macOS" })],
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Version")).toBeVisible();
    await expect(canvas.getByText("Unknown")).toBeVisible();
    await expect(canvas.getByText("Nightly")).toBeVisible();
    await expect(canvas.getByText("macOS")).toBeVisible();

    const written = spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
      await expect(written).toHaveBeenCalledWith("Self-Engine unknown version (nightly), macOS");
    } finally {
      written.mockRestore();
    }
  },
};

export const CopiesOneLineAndConfirmsIt: Story = {
  play: async ({ canvas }) => {
    // The clipboard of the test browser is not the user's, so the story takes its place.
    const written = spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    try {
      const copy = canvas.getByRole("button", { name: "Copy" });
      await expect(copy).toHaveAccessibleDescription("Version information");
      await userEvent.click(copy);
      await expect(written.mock.calls).toEqual([
        ["Self-Engine 0.4.0-nightly.20261112.3 (nightly), macOS"],
      ]);
      await expect(await canvas.findByRole("button", { name: "Copied" })).toBeVisible();
    } finally {
      written.mockRestore();
    }
  },
};

/** About only displays (D203): the copy button is the one thing that can be pressed. */
export const OffersNothingButTheCopy: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Copy",
    ]);
    await expect(canvas.queryAllByRole("link")).toEqual([]);
    for (const role of ["radio", "switch", "combobox", "checkbox"]) {
      await expect(canvas.queryAllByRole(role)).toEqual([]);
    }
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Kanal")).toBeVisible();
    await expect(canvas.getByText("Betriebssystem")).toBeVisible();
    await expect(canvas.getByText("Lizenz")).toBeVisible();
    await expect(
      canvas.getByText(
        "Version, Kanal und Betriebssystem als eine Zeile, für einen Fehlerbericht.",
      ),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Kopieren" })).toBeVisible();
  },
};
