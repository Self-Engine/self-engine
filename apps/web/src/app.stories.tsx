import { activateLanguage, createI18n } from "@self-engine/i18n";
import {
  createHashHistory,
  createMemoryHistory,
  RouterProvider,
  type RouterHistory,
} from "@tanstack/react-router";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createAppRouter } from "./app-router.ts";
import { PreviewLanguage } from "./preview-language.tsx";
import { settingsStore } from "./settings-store.ts";

const i18n = createI18n();

interface AppStoryProps {
  readonly address: string;
  readonly hash?: boolean;
}

function AppStory({ address, hash = false }: AppStoryProps) {
  const [history] = useState<RouterHistory>(() => {
    if (!hash) return createMemoryHistory({ initialEntries: [address] });
    const history = createHashHistory();
    history.replace(address);
    return history;
  });
  const [{ router, generation }, setRouter] = useState(() => ({
    router: createAppRouter(history),
    generation: 0,
  }));
  useEffect(() => () => history.destroy(), [history]);
  return (
    <>
      <RouterProvider key={generation} router={router} />
      <button
        style={{ position: "fixed", bottom: 16, right: 16, zIndex: 500 }}
        onClick={() =>
          setRouter(({ generation }) => ({
            router: createAppRouter(history),
            generation: generation + 1,
          }))
        }
      >
        Reload router
      </button>
    </>
  );
}

const meta = {
  title: "App/Module addresses",
  component: AppStory,
  parameters: { layout: "fullscreen" },
  loaders: [
    async () => {
      await settingsStore.load();
      await activateLanguage(i18n, "en");
    },
  ],
  decorators: [
    (Story) => (
      <PreviewLanguage i18n={i18n} initialLanguage="en">
        <Story />
      </PreviewLanguage>
    ),
  ],
  beforeEach: () => {
    const original = window.location.href;
    return () => window.history.replaceState(null, "", original);
  },
  args: { address: "/" },
} satisfies Meta<typeof AppStory>;
export default meta;
type Story = StoryObj<typeof meta>;

async function expectBeta(canvas: ReturnType<typeof within>) {
  await expect(await canvas.findByText("The minimal module View.")).toBeVisible();
  await expect(canvas.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await expect(canvas.getByRole("link", { name: "Placeholder Beta" })).toHaveAttribute(
    "aria-current",
    "page",
  );
}

export const StartAndNavigate: Story = {
  play: async ({ canvas }) => {
    await expectBeta(canvas);
    await userEvent.click(canvas.getByRole("link", { name: "Settings" }));
    await expect(
      await canvas.findByRole("heading", { name: "Theme preview", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Language sample" }));
    await expect(await canvas.findByText("This sentence is translated.")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Language sample", level: 1 })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reload router" }));
    await expect(await canvas.findByText("This sentence is translated.")).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await expectBeta(canvas);
  },
};

export const DeepLinkAndReload: Story = {
  args: { address: "/placeholder-beta/overview" },
  play: async ({ canvas }) => {
    await expectBeta(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "Reload router" }));
    await expectBeta(canvas);
  },
};
export const ModuleRedirect: Story = {
  ...DeepLinkAndReload,
  args: { address: "/placeholder-beta" },
};
export const SettingsRedirect: Story = {
  args: { address: "/settings" },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("heading", { name: "Theme preview", level: 1 }),
    ).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const UnknownModule: Story = {
  args: { address: "/missing/overview" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Nothing was found at this address.")).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "Modules" })).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await expectBeta(canvas);
  },
};
export const UnknownView: Story = {
  ...UnknownModule,
  args: { address: "/placeholder-beta/missing" },
};
export const UnknownShortAddress: Story = { ...UnknownModule, args: { address: "/missing" } };
export const UnknownDeeperAddress: Story = {
  ...UnknownModule,
  args: { address: "/placeholder-beta/overview/deeper" },
};

export const HashStartAndNavigate: Story = {
  ...StartAndNavigate,
  args: { address: "/", hash: true },
};
export const HashDeepLinkAndReload: Story = {
  ...DeepLinkAndReload,
  args: { address: "/placeholder-beta/overview", hash: true },
};
export const HashModuleRedirect: Story = {
  ...ModuleRedirect,
  args: { address: "/placeholder-beta", hash: true },
};
export const HashUnknownView: Story = {
  ...UnknownView,
  args: { address: "/placeholder-beta/missing", hash: true },
};
export const NamesFollowLanguage: Story = {
  args: { address: "/settings/language-sample" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("This sentence is translated.")).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "Deutsch" }));
    await waitFor(async () => {
      await expect(canvas.getByRole("link", { name: "Einstellungen" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
    await expect(canvas.getByRole("heading", { name: "Sprachbeispiel", level: 1 })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Design-Vorschau" })).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Platzhalter Beta" }));
    await expect(await canvas.findByRole("heading", { name: "Übersicht", level: 1 })).toBeVisible();
  },
};
