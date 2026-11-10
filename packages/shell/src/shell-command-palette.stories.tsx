import { ProjectsIcon } from "@self-engine/icons";
import { confirm } from "@self-engine/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import { z } from "zod";
import {
  defineInputCommand,
  defineOpenCommand,
  definePageCommand,
  type ShellContribution,
  type ShellCommand,
  type ShellProps,
} from "./index.ts";
import {
  appRegionOf,
  onMac,
  onWindows,
  openPalette,
  paletteDialog,
  paletteGone,
  pressEscape,
  SETTINGS,
  shellMeta,
  storyRouting,
} from "./shell-story-helpers.tsx";

const body = { description: "A stand-in.", schema: z.object({}), run: () => undefined };
const label = (message: string) => ({ id: `story-${message}`, message });

const startedNew = fn(async () => ({ default: definePageCommand(body) }));
const startedOtherNew = fn(async () => ({ default: definePageCommand(body) }));
const startedOpen = fn(async () => ({ default: defineOpenCommand(body) }));
const failing = fn(async (): Promise<{ default: ReturnType<typeof definePageCommand> }> => {
  throw new Error("offline");
});

const pageCommand = (message: string, load: typeof startedNew, defaultShortcut?: string) =>
  ({
    id: message.toLowerCase().replaceAll(" ", "-"),
    kind: "page",
    label: label(message),
    ...(defaultShortcut && { defaultShortcut }),
    load,
  }) satisfies ShellCommand;

const openCommand = (message: string, load: typeof startedOpen, defaultShortcut?: string) =>
  ({
    id: message.toLowerCase().replaceAll(" ", "-"),
    kind: "open",
    label: label(message),
    ...(defaultShortcut && { defaultShortcut }),
    load,
  }) satisfies ShellCommand;

const loadView = async () => ({ default: () => null });
const view = (message: string) => ({
  id: message.toLowerCase().replaceAll(" ", "-"),
  title: label(message),
  load: loadView,
});

const moduleOf = (
  id: string,
  views: readonly [string, ...string[]],
  commands: readonly ShellCommand[] = [],
): ShellContribution => ({
  id,
  name: label(`Module ${id}`),
  icon: ProjectsIcon,
  color: "blue",
  views: views.map(view) as unknown as ShellContribution["views"],
  commands,
});

const secret = {
  id: "secret",
  kind: "input",
  load: async () => ({
    default: defineInputCommand({
      description: "A stand-in.",
      schema: z.object({ name: z.string() }),
      run: () => undefined,
    }),
  }),
} satisfies ShellCommand;

const FIRST = moduleOf(
  "first",
  ["Overview", "Archive"],
  [pageCommand("New", startedNew, "Mod+N"), openCommand("Own open", startedOpen), secret],
);
const SECOND = moduleOf(
  "second",
  ["Second board"],
  [pageCommand("Second new", startedOtherNew), openCommand("Refresh", startedOpen, "Mod+Shift+E")],
);

const meta = {
  ...shellMeta,
  title: "Shell/Command palette",
  args: {
    ...shellMeta.args,
    contributions: [SECOND, FIRST],
    settings: SETTINGS,
    routing: storyRouting(),
    activeModule: FIRST,
    activeView: FIRST.views[0],
  },
  beforeEach: () => {
    for (const started of [startedNew, startedOtherNew, startedOpen, failing]) started.mockClear();
    return onWindows();
  },
} satisfies Meta<ShellProps>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The rows from top to bottom: the label, and after it the shortcut if there is one. */
const rowsOf = (palette: HTMLElement) =>
  [...palette.querySelectorAll("[data-action]")].map((row) => row.textContent);

const groupsOf = (palette: HTMLElement) =>
  within(palette)
    .getAllByRole("group")
    .map((group) => group.getAttribute("aria-label"));

const searchIn = (palette: HTMLElement) => within(palette).getByRole("textbox");

const pressShortcut = (keys: string) => userEvent.keyboard(keys);

export const OpensWhileTypingInAFieldAndGivesTheFocusBack: Story = {
  args: { children: <input aria-label="Field" /> },
  play: async ({ canvas }) => {
    const field = canvas.getByRole("textbox", { name: "Field" });
    await userEvent.click(field);
    const palette = await openPalette();
    await waitFor(() => expect(searchIn(palette)).toHaveFocus());
    await pressEscape();
    await paletteGone();
    await waitFor(() => expect(field).toHaveFocus());
    await expect(field).toHaveValue("");
  },
};

export const AnEmptySearchListsTheActiveModuleThenTheOpenCommands: Story = {
  play: async () => {
    const palette = await openPalette();
    await expect(rowsOf(palette)).toEqual([
      "NewCtrl+N",
      "Own open",
      "Overview",
      "Archive",
      "RefreshCtrl+Shift+E",
      "UndoCtrl+Z",
    ]);
    await expect(groupsOf(palette)).toEqual(["Module first", "Module second"]);
  },
};

export const RowsUseTheNotationOfMacOS: Story = {
  beforeEach: onMac,
  play: async () => {
    const palette = await openPalette();
    await expect(rowsOf(palette)[0]).toBe("New⌘N");
  },
};

const LONG = moduleOf(
  "long",
  ["View a", "View b", "View c", "View d", "View e", "View f", "View g", "View h", "View i"],
  [pageCommand("Action", startedNew)],
);

export const ShowsAtMostEightRows: Story = {
  args: { contributions: [LONG], activeModule: LONG, activeView: LONG.views[0] },
  play: async () => {
    const palette = await openPalette();
    await expect(rowsOf(palette)).toHaveLength(8);
    await expect(rowsOf(palette)[0]).toBe("Action");
    await userEvent.keyboard("view");
    await waitFor(() => expect(rowsOf(palette)).toHaveLength(8));
  },
};

const ALSO_MATCHING = moduleOf(
  "elsewhere",
  ["Reports", "Export"],
  [openCommand("Port settings", startedOpen)],
);
const ACTIVE_MATCHING = moduleOf(
  "here",
  ["Support", "Portfolio"],
  [pageCommand("Port plan", startedNew)],
);

export const AWordStartBeatsTheInsideOfAWordThenTheActiveModuleThenTheOrder: Story = {
  args: {
    contributions: [ALSO_MATCHING, ACTIVE_MATCHING],
    activeModule: ACTIVE_MATCHING,
    activeView: ACTIVE_MATCHING.views[0],
  },
  play: async () => {
    const palette = await openPalette();
    await userEvent.keyboard("PORT");
    await waitFor(() => expect(rowsOf(palette)).toHaveLength(6));
    // Ranked: Port plan, Portfolio, Port settings, Support, Reports, Export. The groups follow
    // their best match and keep a module's rows together.
    await expect(groupsOf(palette)).toEqual(["Module here", "Module elsewhere"]);
    await expect(rowsOf(palette)).toEqual([
      "Port plan",
      "Portfolio",
      "Support",
      "Port settings",
      "Reports",
      "Export",
    ]);
  },
};

export const ThePageCommandsOfOtherModulesAreFoundAndInputCommandsNeverAppear: Story = {
  play: async () => {
    const palette = await openPalette();
    await userEvent.keyboard("se");
    await waitFor(() => expect(rowsOf(palette)).toContain("Second board"));
    await expect(rowsOf(palette)).toContain("Second new");
    await expect(
      within(within(palette).getByRole("group", { name: "Module second" })).getByText("Second new"),
    ).toBeVisible();
    await userEvent.clear(searchIn(palette));
    await userEvent.keyboard("secret");
    await within(palette).findByText("Nothing found");
    await expect(rowsOf(palette)).toEqual([]);
  },
};

export const EveryViewIsALinkToItsAddress: Story = {
  play: async () => {
    const palette = await openPalette();
    await userEvent.keyboard("second board");
    await expect(
      await within(palette).findByRole("link", { name: "Second board" }),
    ).toHaveAttribute("href", "/second/second-board");
  },
};

export const EnterOnAFreshPaletteDoesNothing: Story = {
  play: async () => {
    const palette = await openPalette();
    await waitFor(() => expect(searchIn(palette)).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await expect(paletteDialog()).toBeVisible();
    await expect(palette.querySelector("[data-selected]")).toBeNull();
    await expect(startedNew).not.toHaveBeenCalled();
  },
};

export const AnArrowKeyAndEnterStartACommand: Story = {
  play: async () => {
    const palette = await openPalette();
    await waitFor(() => expect(searchIn(palette)).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await paletteGone();
    await expect(startedNew).toHaveBeenCalledOnce();
    await expect(startedOpen).not.toHaveBeenCalled();
  },
};

export const TypingAndEnterStartAnOpenCommandOfAnotherModule: Story = {
  play: async () => {
    await openPalette();
    await userEvent.keyboard("refresh{Enter}");
    await paletteGone();
    await expect(startedOpen).toHaveBeenCalledOnce();
  },
};

export const APageCommandOfAnotherModuleStarts: Story = {
  play: async () => {
    await openPalette();
    await userEvent.keyboard("second new{Enter}");
    await paletteGone();
    await waitFor(() => expect(startedOtherNew).toHaveBeenCalledOnce());
  },
};

const FAILS = moduleOf(
  "fails",
  ["Board"],
  [pageCommand("Broken", failing as unknown as typeof startedNew)],
);

/** The notice store outlives a Story, so this one closes what it shows. */
export const AFailingCommandReportsThroughTheSharedStart: Story = {
  args: { contributions: [FAILS], activeModule: FAILS, activeView: FAILS.views[0] },
  beforeEach: () => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    return () => reported.mockRestore();
  },
  play: async () => {
    await openPalette();
    await userEvent.keyboard("broken{Enter}");
    await paletteGone();
    await expect(await screen.findByRole("alert")).toHaveTextContent("could not be completed");
    await userEvent.click(screen.getByRole("button", { name: "Close notice" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  },
};

/** A leave guard is a module's code and may throw. The move then fails like any other start. */
export const AFailedMoveToAnotherModuleIsReported: Story = {
  args: {
    routing: {
      ...storyRouting(),
      useGoToView: () => () => Promise.reject(new Error("A guard threw")),
    },
  },
  beforeEach: () => {
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    return () => reported.mockRestore();
  },
  play: async () => {
    await openPalette();
    await userEvent.keyboard("second new{Enter}");
    await paletteGone();
    await expect(await screen.findByRole("alert")).toHaveTextContent("could not be completed");
    await expect(startedOtherNew).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Close notice" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  },
};

export const ShortcutsDoNothingWhileThePaletteIsOpen: Story = {
  play: async () => {
    const palette = await openPalette();
    await waitFor(() => expect(searchIn(palette)).toHaveFocus());
    await pressShortcut("{Control>}n{/Control}");
    await pressShortcut("{Control>}{Shift>}e{/Shift}{/Control}");
    await expect(startedNew).not.toHaveBeenCalled();
    await expect(startedOpen).not.toHaveBeenCalled();
    await pressEscape();
    await paletteGone();
    await waitFor(async () => {
      await pressShortcut("{Control>}n{/Control}");
      await expect(startedNew).toHaveBeenCalled();
    });
  },
};

export const TheKeyDoesNothingWhileAConfirmationIsOpen: Story = {
  play: async () => {
    // Opened first and closed again, so that the code is there and the press below could land.
    await openPalette();
    await pressEscape();
    await paletteGone();
    const answer = confirm({ title: "Sure?", message: "Really?", confirmLabel: "Yes" });
    const question = within(await screen.findByRole("dialog", { name: "Sure?" }));
    await pressShortcut("{Control>}k{/Control}");
    await expect(paletteDialog()).toBeNull();
    await userEvent.click(question.getByRole("button", { name: "Cancel" }));
    await expect(await answer).toBe(false);
  },
};

export const TheOverlayOverTheWindowDragRegionStaysClickable: Story = {
  play: async () => {
    await openPalette();
    await expect(appRegionOf(document.querySelector(".mantine-Spotlight-overlay")!)).toBe(
      "no-drag",
    );
    await expect(appRegionOf(document.querySelector(".mantine-Spotlight-content")!)).toBe(
      "no-drag",
    );
  },
};
