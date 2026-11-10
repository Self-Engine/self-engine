import type { Meta, StoryObj } from "@storybook/react-vite";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { contribution as beta } from "@self-engine/placeholder-beta";
import {
  definePageCommand,
  type PageCommand,
  type ShellCommand,
  type ShellContribution,
  type ShellView,
} from "@self-engine/shell";
import { expect, fn, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";
import { settingsStore } from "./settings-store.ts";
import {
  answer,
  AppAt,
  asked,
  editInAddress,
  editStudio,
  held,
  modKeyIsLeftToTheBrowser,
  noDrawer,
  noQuestion,
  openPalette,
  paletteGone,
  pressWithMod,
  QUESTION,
  storyRouter,
} from "./story-app.tsx";

const OVERVIEW = "/placeholder-alpha/overview";
const BETA = "/placeholder-beta/overview";

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

function spiedNewEntry() {
  newEntry = spyOnNewEntry();
  return () => newEntry.mockRestore();
}

export const APageCommandStartsAndOpensItsDrawer: Story = {
  beforeEach: spiedNewEntry,
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

const startNewEntry = async () => {
  await openPalette();
  await userEvent.keyboard("new entry{Enter}");
  await paletteGone();
};

export const AnotherModulesCommandMovesThereFirstAndRunsThere: Story = {
  args: { address: BETA },
  beforeEach: spiedNewEntry,
  play: async () => {
    await startNewEntry();
    await screen.findByRole("dialog", { name: "New entry" });
    await expect(newEntry).toHaveBeenCalledOnce();
    await expect(storyRouter().state.location.pathname).toBe(OVERVIEW);
    await waitFor(() => expect(editInAddress(storyRouter())).toBe("new"));
  },
};

export const APageShortcutIsInertInAnotherModuleAndWorksInItsOwn: Story = {
  args: { address: BETA },
  beforeEach: spiedNewEntry,
  play: async ({ canvas }) => {
    await canvas.findByText("The minimal module View.");
    // ⌘K is bound beside it, so from here on a press could land.
    await openPalette();
    await userEvent.keyboard("{Escape}");
    await paletteGone();
    await pressWithMod("n");
    await expect(newEntry).not.toHaveBeenCalled();
    await expect(screen.queryByRole("dialog")).toBeNull();
    await expect(storyRouter().state.location.pathname).toBe(BETA);
    await expect(modKeyIsLeftToTheBrowser(document.body, "n")).toBe(true);

    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Alpha" }));
    await canvas.findByRole("button", { name: "New entry" });
    await waitFor(async () => {
      await pressWithMod("n");
      await expect(newEntry).toHaveBeenCalled();
    });
    await screen.findByRole("dialog", { name: "New entry" });
  },
};

const heldAlphaView = () => {
  const view = held<Awaited<ReturnType<ShellView["load"]>>>();
  const load = spyOn(alpha.views[0] as { load: ShellView["load"] }, "load").mockReturnValue(
    view.promise,
  );
  return { view, load };
};
let slowAlpha: ReturnType<typeof heldAlphaView>;
const AlphaStandIn = () => <p>Alpha stand-in</p>;

export const ASlowTargetKeepsTheCommandBackUntilItIsOnScreen: Story = {
  args: { address: BETA },
  beforeEach: () => {
    slowAlpha = heldAlphaView();
    const restore = spiedNewEntry();
    return () => {
      slowAlpha.load.mockRestore();
      restore();
    };
  },
  play: async ({ canvas }) => {
    await startNewEntry();
    await waitFor(() => expect(storyRouter().state.location.pathname).toBe(OVERVIEW));
    await expect(newEntry).not.toHaveBeenCalled();
    slowAlpha.view.finish({ default: AlphaStandIn });
    await expect(await canvas.findByText("Alpha stand-in")).toBeVisible();
    await screen.findByRole("dialog", { name: "New entry" });
    await expect(newEntry).toHaveBeenCalledOnce();
    await waitFor(() => expect(editInAddress(storyRouter())).toBe("new"));
  },
};

export const AnotherNavigationThatOvertakesTheMoveStopsTheCommand: Story = {
  args: { address: BETA },
  beforeEach: () => {
    slowAlpha = heldAlphaView();
    const restore = spiedNewEntry();
    return () => {
      slowAlpha.load.mockRestore();
      restore();
    };
  },
  play: async ({ canvas }) => {
    await startNewEntry();
    await waitFor(() => expect(storyRouter().state.location.pathname).toBe(OVERVIEW));
    await userEvent.click(canvas.getByRole("link", { name: "Placeholder Beta" }));
    await waitFor(() => expect(storyRouter().state.location.pathname).toBe(BETA));
    await waitFor(() => expect(storyRouter().state.status).toBe("idle"));
    await expect(newEntry).not.toHaveBeenCalled();
    await expect(editInAddress(storyRouter())).toBeUndefined();
  },
};

/** The notice store outlives a Story, so this one closes what it shows. */
export const ACommandThatFailsAfterTheMoveShowsTheNotice: Story = {
  args: { address: BETA },
  beforeEach: () => {
    const restore = spiedNewEntry();
    newEntry.mockRejectedValueOnce(new Error("offline"));
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    return () => {
      reported.mockRestore();
      restore();
    };
  },
  play: async () => {
    await startNewEntry();
    await expect(await screen.findByRole("alert")).toHaveTextContent("could not be completed");
    await expect(storyRouter().state.location.pathname).toBe(OVERVIEW);
    await userEvent.click(screen.getByRole("button", { name: "Close notice" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  },
};

const loadNote = fn(async () => ({
  default: definePageCommand({
    description: "A stand-in.",
    schema: z.object({}),
    run: (_input, { writeSearch }) => writeSearch((search) => ({ ...search, edit: "note" })),
  }),
}));

const NOTE: PageCommand = {
  id: "note",
  kind: "page",
  label: { id: "story-Beta note", message: "Beta note" },
  load: loadNote,
};

/** No placeholder has a draft and another module's `page` Command to go with it, so one is lent. */
function betaHasANote() {
  loadNote.mockClear();
  const owner = beta as ShellContribution as { commands?: readonly ShellCommand[] };
  owner.commands = [NOTE];
  return () => {
    delete owner.commands;
  };
}

const startNote = async () => {
  await openPalette();
  await userEvent.keyboard("beta note{Enter}");
  await paletteGone();
};

const address = () => ({
  pathname: storyRouter().state.location.pathname,
  edit: editInAddress(storyRouter()),
});

export const KeepEditingStopsTheCommandAndItCanBeStartedAgain: Story = {
  beforeEach: betaHasANote,
  play: async ({ canvas }) => {
    const { name } = await editStudio(canvas);
    await startNote();
    await answer("Keep editing");
    await noQuestion();
    await expect(loadNote).not.toHaveBeenCalled();
    await expect(address()).toEqual({ pathname: OVERVIEW, edit: "studio" });
    await expect(name).toHaveValue("Studio work changed");
    await waitFor(() => expect(name).toHaveFocus());
    // A second start only reaches the question if the first one has ended.
    await startNote();
    await answer("Keep editing");
    await noQuestion();
    await expect(loadNote).not.toHaveBeenCalled();
    await expect(address()).toEqual({ pathname: OVERVIEW, edit: "studio" });
  },
};

export const DiscardMovesAndRunsTheCommand: Story = {
  beforeEach: betaHasANote,
  play: async ({ canvas }) => {
    await editStudio(canvas);
    await startNote();
    await answer("Discard");
    await noDrawer("Studio work");
    await waitFor(() => expect(address()).toEqual({ pathname: BETA, edit: "note" }));
    await expect(loadNote).toHaveBeenCalledOnce();
  },
};

/** The press lands on a row behind the question, the only way to start one while it is open. */
export const AQuestionAlreadyOpenAlsoStopsTheCommand: Story = {
  beforeEach: betaHasANote,
  play: async ({ canvas }) => {
    await editStudio(canvas);
    const palette = within(await openPalette());
    await userEvent.keyboard("beta note");
    const row = await palette.findByRole("button", { name: "Beta note" });
    void storyRouter().navigate({
      to: "/$module/$view",
      params: { module: "placeholder-alpha", view: "archive" },
    });
    await asked();
    row.click();
    await paletteGone();
    await expect(screen.getAllByRole("dialog", { name: QUESTION })).toHaveLength(1);
    await expect(loadNote).not.toHaveBeenCalled();
    await answer("Keep editing");
    await noQuestion();
    await expect(address()).toEqual({ pathname: OVERVIEW, edit: "studio" });
    await startNote();
    await answer("Discard");
    await waitFor(() => expect(address()).toEqual({ pathname: BETA, edit: "note" }));
    await expect(loadNote).toHaveBeenCalledOnce();
  },
};
