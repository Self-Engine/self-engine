import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { settingsStore } from "./settings-store.ts";
import {
  AppAt,
  editInAddress,
  modKeyIsLeftToTheBrowser,
  pressWithMod,
  QUESTION,
  storyRouter,
} from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;

const OVERVIEW = "/placeholder-alpha/overview";

const meta = {
  title: "App/Delete and missing entries",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [() => settingsStore.load()],
  args: { address: OVERVIEW },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const openEntry = () => editInAddress(storyRouter());

const noDrawer = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

/** A notice stays until the story answers it. */
const keepNoticesOpen = () => holdTimers(8000).restore;

const listed = (canvas: Canvas) =>
  canvas
    .getAllByRole("button", { name: /^(Studio|Garden) work$/ })
    .map((row: HTMLElement) => row.textContent);

const deleteFromTheList = async (canvas: Canvas, name: string) =>
  userEvent.click(await canvas.findByRole("button", { name: `Delete ${name}` }));

const undoLast = async () => {
  const offers = await screen.findAllByRole("button", { name: "Undo" });
  await userEvent.click(offers.at(-1)!);
};

const noUndoOffer = () =>
  waitFor(() => expect(screen.queryByRole("button", { name: "Undo" })).toBeNull());

export const DeletingFromTheListIsImmediateAndUndoRestoresThePosition: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("button", { name: "Studio work" })).toBeVisible();
    await expect(listed(canvas)).toEqual(["Studio work", "Garden work"]);
    await deleteFromTheList(canvas, "Studio work");
    await waitFor(() => expect(listed(canvas)).toEqual(["Garden work"]));
    const notice = await screen.findByText("Deleted");
    await waitFor(() => expect(notice).toBeVisible());
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

const editStudio = async (canvas: Canvas) => {
  await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
  const drawer = await screen.findByRole("dialog", { name: "Studio work" });
  await userEvent.type(await within(drawer).findByRole("textbox", { name: "Name" }), " changed");
  return within(drawer);
};

export const DeletingFromTheDrawerClosesWithoutAskingAndUndoDoesNotReopen: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    const drawer = await editStudio(canvas);
    await userEvent.click(drawer.getByRole("button", { name: "Delete" }));
    // The form stays on the deleted entry while the drawer slides out.
    await expect(screen.queryByText("Entry not found")).toBeNull();
    await noDrawer();
    await expect(openEntry()).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await expect(listed(canvas)).toEqual(["Garden work"]);
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await expect(screen.queryByRole("dialog")).toBeNull();
    await expect(openEntry()).toBeUndefined();
    await noUndoOffer();
  },
};

export const TwoQuickDeletesAreUndoneSeparately: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Studio work");
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2));
    await expect(canvas.queryByRole("button", { name: "Studio work" })).toBeNull();
    await undoLast();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1));
    await expect(listed(canvas)).toHaveLength(1);
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

const pressUndo = () => pressWithMod("z");

/** The bindings load after the first paint. Ends on the press that took back a delete. */
async function undoShortcutArrived(canvas: Canvas) {
  await deleteFromTheList(canvas, "Studio work");
  await waitFor(() => expect(listed(canvas)).toEqual(["Garden work"]));
  await waitFor(async () => {
    await pressUndo();
    await expect(listed(canvas)).toEqual(["Studio work", "Garden work"]);
  });
  await noUndoOffer();
}

export const CommandZAfterADeleteTakesItBackAndHidesItsNotice: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => undoShortcutArrived(canvas),
};

export const CommandZTakesBackTheMostRecentDeleteFirst: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await undoShortcutArrived(canvas);
    await deleteFromTheList(canvas, "Studio work");
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2));
    await pressUndo();
    await expect(await canvas.findByRole("button", { name: "Garden work" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Studio work" })).toBeNull();
    await pressUndo();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

export const TwoQuickCommandZStepBackTwoDeletes: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await undoShortcutArrived(canvas);
    await deleteFromTheList(canvas, "Studio work");
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(2));
    // Without waiting: the first notice is still sliding out when the second press lands.
    await pressUndo();
    await pressUndo();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

export const CommandZInAFieldLeavesTheNoticeAndTheTextAlone: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await undoShortcutArrived(canvas);
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work"]));
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Studio work" }));
    const name = await drawer.findByRole("textbox", { name: "Name" });
    await userEvent.click(name);
    await expect(name).toHaveFocus();

    // Left to the browser means that it goes on to undo the typing.
    await expect(modKeyIsLeftToTheBrowser(name, "z")).toBe(true);
    await expect(listed(canvas)).toEqual(["Studio work"]);
    // Under a loaded run the notice can still be sliding in.
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeVisible());

    await userEvent.click(drawer.getByRole("button", { name: "Cancel" }));
    await noDrawer();
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

export const CommandZWithNoNoticeDoesNothing: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await undoShortcutArrived(canvas);
    await pressUndo();
    await expect(listed(canvas)).toEqual(["Studio work", "Garden work"]);
    await expect(screen.queryByRole("dialog")).toBeNull();
    await expect(screen.queryByRole("alert")).toBeNull();
  },
};

export const AnEmptyListSaysSoAndOffersTheNextStep: Story = {
  beforeEach: keepNoticesOpen,
  args: { address: `${OVERVIEW}?client=garden` },
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Garden work");
    const empty = within((await canvas.findByText("No entries here")).parentElement!);
    await userEvent.click(empty.getByRole("button", { name: "New entry" }));
    await screen.findByRole("dialog", { name: "New entry" });
    await expect(openEntry()).toBe("new");
    await userEvent.click(screen.getByRole("button", { name: "Close editor" }));
    await noDrawer();
    await undoLast();
    await expect(await canvas.findByRole("button", { name: "Garden work" })).toBeVisible();
    await expect(canvas.queryByText("No entries here")).toBeNull();
    await noUndoOffer();
  },
};

export const AFailedLoadCanBeRetried: Story = {
  args: { address: `${OVERVIEW}?edit=flaky` },
  play: async () => {
    const drawer = within(await screen.findByRole("dialog", { name: "Placeholder Alpha" }));
    const failure = await drawer.findByRole("alert");
    await expect(failure).toHaveTextContent("This entry could not be loaded.");
    await userEvent.click(within(failure).getByRole("button", { name: "Try again" }));
    await expect(await drawer.findByRole("textbox", { name: "Name" })).toHaveValue("Flaky work");
    await expect(drawer.queryByRole("alert")).toBeNull();
    await screen.findByRole("dialog", { name: "Flaky work" });
  },
};

export const AnOldLinkToADeletedEntrySaysItWasNotFound: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Studio work");
    await waitFor(() => expect(listed(canvas)).toEqual(["Garden work"]));
    storyRouter().history.push(`${OVERVIEW}?edit=studio`);
    const drawer = within(await screen.findByRole("dialog", { name: "Placeholder Alpha" }));
    await expect(await drawer.findByRole("alert")).toHaveTextContent("Entry not found");
    await userEvent.click(drawer.getByRole("button", { name: "Close" }));
    await noDrawer();
    await undoLast();
    await waitFor(() => expect(listed(canvas)).toEqual(["Studio work", "Garden work"]));
    await noUndoOffer();
  },
};

export const AnUnknownEntrySaysSoAndOffersOnlyToClose: Story = {
  args: { address: `${OVERVIEW}?edit=no-such-entry` },
  play: async () => {
    const drawer = within(await screen.findByRole("dialog", { name: "Placeholder Alpha" }));
    const failure = await drawer.findByRole("alert");
    await expect(failure).toHaveTextContent("Entry not found");
    await expect(within(failure).getAllByRole("button")).toHaveLength(1);
    await expect(drawer.queryByRole("textbox")).toBeNull();
    await expect(drawer.queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(within(failure).getByRole("button", { name: "Close" }));
    await noDrawer();
    await expect(openEntry()).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
  },
};
