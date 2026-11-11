import { activateLanguage, createI18n } from "@self-engine/i18n";
import { APP_LANGUAGE_SETTING } from "@self-engine/settings-area/settings";
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
import { AppLanguage } from "./app-language.tsx";
import { settingsStore } from "./settings-store.ts";
import { openPalette, paletteGone } from "./story-app.tsx";

const i18n = createI18n();
const ENGLISH_SYSTEM = () => ["en"];
const resetLanguage = () => settingsStore.write(APP_LANGUAGE_SETTING, APP_LANGUAGE_SETTING.default);

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
        style={{ position: "fixed", bottom: 56, right: 16, zIndex: 500 }}
        onClick={() => history.back()}
      >
        Back in history
      </button>
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
      <AppLanguage i18n={i18n} initialLanguage="en" systemLanguages={ENGLISH_SYSTEM}>
        <Story />
      </AppLanguage>
    ),
  ],
  beforeEach: () => {
    const original = window.location.href;
    // The test runner's query, which the hash parser would add to the last parameter after Back.
    window.history.replaceState(null, "", window.location.pathname);
    return () => {
      window.history.replaceState(null, "", original);
      // The store is the app's one, on the browser's storage, which the next story shares.
      resetLanguage();
    };
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
      await canvas.findByRole("heading", { name: "Appearance", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Language" }));
    await expect(await canvas.findByRole("radiogroup", { name: "App Language" })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Language", level: 1 })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reload router" }));
    await expect(await canvas.findByRole("radiogroup", { name: "App Language" })).toBeVisible();
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
      await canvas.findByRole("heading", { name: "Appearance", level: 1 }),
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
  args: { address: "/settings/language" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("radio", { name: "Deutsch" }));
    await waitFor(async () => {
      await expect(canvas.getByRole("link", { name: "Einstellungen" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
    await expect(canvas.getByRole("heading", { name: "Sprache", level: 1 })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Design-Vorschau" })).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Platzhalter Beta" }));
    await expect(await canvas.findByRole("heading", { name: "Übersicht", level: 1 })).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Platzhalter Alpha" }));
    await expect(await canvas.findByRole("button", { name: "Neuer Eintrag" })).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Einstellungen" }));
    await userEvent.click(await canvas.findByRole("link", { name: "Sprache" }));
    await userEvent.click(await canvas.findByRole("radio", { name: "English" }));
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Alpha" }));
    await expect(await canvas.findByRole("button", { name: "New entry" })).toBeVisible();
  },
};

export const PaletteLabelsFollowTheLanguage: Story = {
  args: { address: "/settings/language" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("radiogroup", { name: "App Language" })).toBeVisible();
    const english = within(await openPalette());
    await expect(await english.findByRole("link", { name: "Language" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await paletteGone();
    await userEvent.click(canvas.getByRole("radio", { name: "Deutsch" }));
    await expect(await canvas.findByRole("heading", { name: "Sprache", level: 1 })).toBeVisible();
    const german = within(await openPalette("Befehlspalette"));
    await expect(await german.findByRole("link", { name: "Sprache" })).toBeVisible();
  },
};

export const GroupFilters: Story = {
  args: { address: "/placeholder-alpha/overview?client=studio&page=2&edit=sample" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Studio work")).toBeVisible();
    await expect(canvas.queryByText("Garden work")).toBeNull();
    const archive = canvas.getByRole("link", { name: "Archive" });
    await expect(archive.getAttribute("href")?.split("#").at(-1)).toBe(
      "/placeholder-alpha/archive?client=studio",
    );
    await userEvent.click(archive);
    await expect(await canvas.findByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await expect(canvas.getByText("Studio work")).toBeVisible();
    await userEvent.click(await canvas.findByRole("link", { name: "Garden" }));
    await expect(await canvas.findByText("Garden work")).toBeVisible();
    await expect(canvas.queryByText("Studio work")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Back in history" }));
    await expect(await canvas.findByText("Studio work")).toBeVisible();
    await userEvent.click(await canvas.findByRole("link", { name: "Garden" }));
    await expect(await canvas.findByText("Garden work")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reload router" }));
    await expect(await canvas.findByText("Garden work")).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await expectBeta(canvas);
    await expect(
      canvas
        .getByRole("link", { name: "Placeholder Alpha" })
        .getAttribute("href")
        ?.split("#")
        .at(-1),
    ).toBe("/placeholder-alpha/overview");
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Alpha" }));
    await expect(await canvas.findByText("Studio work")).toBeVisible();
    await expect(canvas.getByText("Garden work")).toBeVisible();
  },
};
export const HashGroupFilters: Story = {
  ...GroupFilters,
  args: { ...GroupFilters.args, hash: true },
};

export const InvalidClientFilter: Story = {
  args: { address: "/placeholder-alpha/overview?client=unknown" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Studio work")).toBeVisible();
    await expect(canvas.getByText("Garden work")).toBeVisible();
  },
};

export const EditDrawer: Story = {
  args: { address: "/placeholder-alpha/overview?client=studio" },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    await expect(await page.findByRole("dialog", { name: "Studio work" })).toHaveTextContent(
      "studio",
    );
    await userEvent.click(page.getByRole("button", { name: "Close editor" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await userEvent.click(canvas.getByRole("button", { name: "Reload router" }));
    await expect(await canvas.findByRole("button", { name: "Studio work" })).toBeVisible();
    await expect(page.queryByRole("dialog")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Back in history" }));
    await expect(await page.findByRole("dialog")).toHaveTextContent("studio");
    await userEvent.click(canvas.getByRole("button", { name: "Reload router" }));
    await expect(await page.findByRole("dialog")).toHaveTextContent("studio");
    await userEvent.click(canvas.getByRole("link", { name: "Archive" }));
    await expect(await canvas.findByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};
export const HashEditDrawer: Story = { ...EditDrawer, args: { ...EditDrawer.args, hash: true } };

export const EditDeepLink: Story = {
  args: { address: "/placeholder-alpha/archive?edit=studio" },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByRole("dialog", { name: "Studio work" })).toHaveTextContent(
      "studio",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Reload router" }));
    await expect(await page.findByRole("dialog")).toHaveTextContent("studio");
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await expectBeta(canvas);
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await userEvent.click(canvas.getByRole("button", { name: "Back in history" }));
    await expect(await page.findByRole("dialog")).toHaveTextContent("studio");
  },
};
export const HashEditDeepLink: Story = {
  ...EditDeepLink,
  args: { ...EditDeepLink.args, hash: true },
};

export const BetaWithoutDrawer: Story = {
  args: { address: "/placeholder-beta/overview?edit=ignored" },
  play: async ({ canvas, canvasElement }) => {
    await expectBeta(canvas);
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.queryByRole("dialog")).toBeNull();
    await userEvent.click(canvas.getByRole("link", { name: "Settings" }));
    await expect(
      await canvas.findByRole("heading", { name: "Appearance", level: 1 }),
    ).toBeVisible();
    await expect(page.queryByRole("dialog")).toBeNull();
  },
};

export const PrimaryAction: Story = {
  args: { address: "/placeholder-alpha/overview?client=studio" },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("button", { name: "New entry" }));
    await expect(await page.findByRole("dialog", { name: "New entry" })).toHaveTextContent("new");
    await userEvent.click(page.getByRole("button", { name: "Close editor" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await expect(canvas.getByText("Studio work")).toBeVisible();
    await expect(canvas.queryByText("Garden work")).toBeNull();
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await expectBeta(canvas);
    await expect(canvas.queryByRole("button", { name: "New entry" })).toBeNull();
  },
};
export const HashPrimaryAction: Story = {
  ...PrimaryAction,
  args: { ...PrimaryAction.args, hash: true },
};
