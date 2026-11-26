// The Views of `placeholder-alpha` in each of their states, over Fixed Answers (D255). An
// Operation's Fixed Answer changes nothing and no Table Change follows, so these stories show
// states, not flows: that the list follows an Operation is shown by the module's Port test.

import { changingAnswers } from "@self-engine/data-client/testing";
import {
  GARDEN_WORK,
  placeholderAlphaAnswers,
  STUDIO_WORK,
} from "@self-engine/placeholder-alpha/testing";
import { LOADER_DELAY_MS } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { settled } from "@self-engine/ui/story-surfaces";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  AppAt,
  editInAddress,
  keepNoticesOpen,
  loadStoryApp,
  modKeyIsLeftToTheBrowser,
  noDrawer,
  pressWithMod,
  QUESTION,
  storyRouter,
  undoLast,
} from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;

const OVERVIEW = "/placeholder-alpha/overview";

const meta = {
  title: "App/Placeholder Alpha entries",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [loadStoryApp],
  args: { address: OVERVIEW, access: placeholderAlphaAnswers() },
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const openEntry = () => editInAddress(storyRouter());

const listed = (canvas: Canvas) =>
  canvas
    .getAllByRole("button", { name: /^(Studio|Garden) work$/ })
    .map((row: HTMLElement) => row.textContent);

const deleteFromTheList = async (canvas: Canvas, name: string) =>
  userEvent.click(await canvas.findByRole("button", { name: `Delete ${name}` }));

const undoOffers = () => screen.queryAllByRole("button", { name: "Undo" });

const noUndoOffer = () => waitFor(() => expect(undoOffers()).toHaveLength(0));

/** These stories leave a Notice on screen, and the store outlives the story. */
function isolatedNotices() {
  clearNotices();
  const restoreTimers = keepNoticesOpen();
  return () => {
    clearNotices();
    restoreTimers();
  };
}

export const TheListShowsItsRows: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("button", { name: "Studio work" })).toBeVisible();
    await expect(listed(canvas)).toEqual(["Studio work", "Garden work"]);
    await expect(canvas.getByRole("button", { name: "Delete Garden work" })).toBeVisible();
  },
};

export const AnEmptyListSaysSoAndOffersTheNextStep: Story = {
  args: { access: placeholderAlphaAnswers({ list: { data: [] } }) },
  play: async ({ canvas }) => {
    const empty = within((await canvas.findByText("No entries here")).parentElement!);
    await userEvent.click(empty.getByRole("button", { name: "New entry" }));
    await screen.findByRole("dialog", { name: "New entry" });
    await expect(openEntry()).toBe("new");
  },
};

/** What the Data Process's Query-to-tables list says about `placeholder-alpha` (D248). */
const QUERIES = { placeholderAlpha: { list: ["placeholder_alpha_entries"] } };

/** An empty list whose create answers "Studio work", and the Table Change the story delivers. */
function aCreateIntoTheEmptyList() {
  const port = changingAnswers(
    placeholderAlphaAnswers({ list: { data: [] }, create: { data: STUDIO_WORK } }),
    QUERIES,
  );
  const created = () =>
    port.change(placeholderAlphaAnswers({ list: { data: [STUDIO_WORK] } }), [
      "placeholder_alpha_entries",
    ]);
  return { access: port.access, created };
}

/**
 * The button that opened the drawer leaves with the empty list, and the new row arrives with the
 * reload after the drawer closed: the row takes the focus then (ADR 0041).
 */
export const AnEntryCreatedFromTheEmptyListTakesTheFocusOnceListed: Story = {
  loaders: [async () => ({ port: aCreateIntoTheEmptyList() })],
  render: (args, { loaded }) => <AppAt {...args} access={loaded["port"].access} />,
  play: async ({ canvas, loaded }) => {
    const port: ReturnType<typeof aCreateIntoTheEmptyList> = loaded["port"];
    const empty = within((await canvas.findByText("No entries here")).parentElement!);
    await userEvent.click(empty.getByRole("button", { name: "New entry" }));
    const drawer = within(await settled(screen.findByRole("dialog", { name: "New entry" })));
    await userEvent.type(await drawer.findByRole("textbox", { name: "Name" }), "Studio work");
    await userEvent.click(drawer.getByRole("button", { name: "Save" }));
    await noDrawer();
    port.created();
    const row = await canvas.findByRole("button", { name: "Studio work" });
    await waitFor(() => expect(row).toHaveFocus());
  },
};

/** The loading state's wait, run when the story says so. */
let heldWait: ReturnType<typeof holdTimers>["held"];

export const ASlowLoadShowsTheLoadingStateAfterItsWait: Story = {
  args: { access: placeholderAlphaAnswers({ list: "loading" }) },
  beforeEach: () => {
    const timers = holdTimers(LOADER_DELAY_MS);
    heldWait = timers.held;
    return timers.restore;
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(canvas.queryByRole("status", { name: "Loading" })).toBeNull();
    await waitFor(() => expect(heldWait.size).toBeGreaterThan(0));
    for (const finish of heldWait.values()) finish();
    await expect(await canvas.findByRole("status", { name: "Loading" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Studio work" })).toBeNull();
  },
};

export const AFailedLoadOffersToTryAgain: Story = {
  args: { access: placeholderAlphaAnswers({ list: "unexpected" }) },
  play: async ({ canvas }) => {
    const failure = await canvas.findByRole("alert");
    await expect(failure).toHaveTextContent("This part could not be loaded.");
    await userEvent.click(within(failure).getByRole("button", { name: "Try again" }));
    // The Fixed Answer fails again, so the error state comes back, with no notice.
    await expect(await canvas.findByRole("alert")).toHaveTextContent("could not be loaded");
    await expect(screen.queryAllByRole("alert")).toHaveLength(1);
  },
};

/** The entry whose first read fails, which the in-memory sample data used to fake (D252). */
export const ADrawerWhoseLoadFailsOffersToTryAgain: Story = {
  args: {
    address: `${OVERVIEW}?edit=${STUDIO_WORK.id}`,
    access: placeholderAlphaAnswers({ list: "unexpected" }),
  },
  play: async () => {
    const drawer = within(
      await settled(screen.findByRole("dialog", { name: "Placeholder Alpha" })),
    );
    const failure = await drawer.findByRole("alert");
    await expect(failure).toHaveTextContent("This part could not be loaded.");
    await expect(within(failure).getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(drawer.queryByRole("textbox")).toBeNull();
  },
};

/** Types a new name for Studio work in its drawer and saves. */
async function renameStudio(canvas: Canvas) {
  await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
  const drawer = within(await settled(screen.findByRole("dialog", { name: "Studio work" })));
  const name = await drawer.findByRole("textbox", { name: "Name" });
  await userEvent.clear(name);
  await userEvent.type(name, GARDEN_WORK.name);
  await userEvent.click(drawer.getByRole("button", { name: "Save" }));
  return { drawer, name };
}

export const ATakenNameIsShownAtTheFieldAndTheDrawerStaysOpen: Story = {
  args: { access: placeholderAlphaAnswers({ rename: { conflict: "name_taken" } }) },
  play: async ({ canvas }) => {
    const { drawer, name } = await renameStudio(canvas);
    const conflict = await drawer.findByText("An entry with this name already exists.");
    await waitFor(() => expect(conflict).toBeVisible());
    await expect(name).toHaveAccessibleDescription("An entry with this name already exists.");
    await expect(name).toHaveValue("Garden work");
    await expect(screen.getByRole("dialog", { name: "Studio work" })).toBeVisible();
    await expect(screen.queryByText("This entry no longer exists.")).toBeNull();
    // Typing again clears the text, as the name is a new one.
    await userEvent.type(name, " 2");
    await expect(drawer.queryByText("An entry with this name already exists.")).toBeNull();
  },
};

export const ATakenNameInGerman: Story = {
  ...ATakenNameIsShownAtTheFieldAndTheDrawerStaysOpen,
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    const drawer = within(await settled(screen.findByRole("dialog", { name: "Studio work" })));
    await userEvent.type(await drawer.findByRole("textbox", { name: "Name" }), "!");
    await userEvent.click(drawer.getByRole("button", { name: "Speichern" }));
    const conflict = await drawer.findByText("Ein Eintrag mit diesem Namen existiert bereits.");
    await waitFor(() => expect(conflict).toBeVisible());
  },
};

export const AnEntryGoneWhileEditingIsAnnouncedAndTheDrawerCloses: Story = {
  beforeEach: keepNoticesOpen,
  args: { access: placeholderAlphaAnswers({ rename: "notFound" }) },
  play: async ({ canvas }) => {
    await renameStudio(canvas);
    const notice = await screen.findByText("This entry no longer exists.");
    await waitFor(() => expect(notice).toBeVisible());
    await noDrawer();
    await expect(openEntry()).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
  },
};

export const DeletingFromTheListOffersUndo: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Studio work");
    const notice = await screen.findByText("Deleted");
    await waitFor(() => expect(notice).toBeVisible());
    await undoLast();
    await noUndoOffer();
    await expect(screen.queryByText("That could not be undone.")).toBeNull();
  },
};

export const DeletingFromTheDrawerClosesWithoutAskingAndUndoDoesNotReopen: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    const drawer = within(await settled(screen.findByRole("dialog", { name: "Studio work" })));
    await userEvent.type(await drawer.findByRole("textbox", { name: "Name" }), " changed");
    await userEvent.click(drawer.getByRole("button", { name: "Delete" }));
    // The drawer retains the entry while it slides out.
    await expect(screen.queryByText("Entry not found")).toBeNull();
    await noDrawer();
    await expect(openEntry()).toBeUndefined();
    await expect(screen.queryByRole("dialog", { name: QUESTION })).toBeNull();
    await undoLast();
    await noUndoOffer();
    await expect(screen.queryByRole("dialog")).toBeNull();
    await expect(openEntry()).toBeUndefined();
  },
};

export const AFailedDeleteKeepsTheDrawerOpenWithWhatWasTyped: Story = {
  beforeEach: isolatedNotices,
  args: { access: placeholderAlphaAnswers({ delete: "unexpected" }) },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    const dialog = await settled(screen.findByRole("dialog", { name: "Studio work" }));
    const drawer = within(dialog);
    const name = await drawer.findByRole("textbox", { name: "Name" });
    await userEvent.type(name, " changed");
    await userEvent.click(drawer.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.getByText("Something went wrong, and the change was not saved.")).toBeVisible(),
    );
    await expect(dialog).toBeVisible();
    await expect(openEntry()).toBe(STUDIO_WORK.id);
    await expect(name).toHaveValue("Studio work changed");
    await expect(drawer.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};

export const DeletingAnEntryAlreadyGoneClosesWithoutWarning: Story = {
  beforeEach: isolatedNotices,
  args: { access: placeholderAlphaAnswers({ delete: "notFound" }) },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    const dialog = await settled(screen.findByRole("dialog", { name: "Studio work" }));
    // Watched until the drawer has gone: the warning must not show while it closes either.
    let warned = false;
    const watch = new MutationObserver(() => {
      if (dialog.textContent.includes("This entry was deleted")) warned = true;
    });
    watch.observe(dialog, { childList: true, subtree: true, characterData: true });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
      await expect(dialog).not.toHaveTextContent("This entry was deleted");
      await noDrawer();
    } finally {
      watch.disconnect();
    }
    await expect(warned).toBe(false);
    await expect(openEntry()).toBeUndefined();
    await expect(await screen.findByText("This entry no longer exists.")).toBeVisible();
    await expect(undoOffers()).toHaveLength(0);
  },
};

export const UndoIntoATakenNameSaysSo: Story = {
  beforeEach: keepNoticesOpen,
  args: { access: placeholderAlphaAnswers({ restore: { conflict: "name_taken" } }) },
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Studio work");
    await undoLast();
    const notice = await screen.findByText(
      "The entry could not come back: another entry has its name now.",
    );
    await waitFor(() => expect(notice).toBeVisible());
  },
};

export const TwoQuickDeletesAreUndoneSeparately: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await deleteFromTheList(canvas, "Studio work");
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(undoOffers()).toHaveLength(2));
    await undoLast();
    await waitFor(() => expect(undoOffers()).toHaveLength(1));
    await undoLast();
    await noUndoOffer();
  },
};

const pressUndo = () => pressWithMod("z");

/** The bindings load after the first paint. Ends on the press that took back a delete. */
async function undoShortcutArrived(canvas: Canvas) {
  await deleteFromTheList(canvas, "Studio work");
  await waitFor(() => expect(undoOffers()).toHaveLength(1));
  await waitFor(async () => {
    await pressUndo();
    await expect(undoOffers()).toHaveLength(0);
  });
}

export const CommandZAfterADeleteTakesItBackAndHidesItsNotice: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => undoShortcutArrived(canvas),
};

export const TwoQuickCommandZStepBackTwoDeletes: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await undoShortcutArrived(canvas);
    await deleteFromTheList(canvas, "Studio work");
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(undoOffers()).toHaveLength(2));
    // Without waiting: the first notice is still sliding out when the second press lands.
    await pressUndo();
    await pressUndo();
    await noUndoOffer();
  },
};

export const CommandZInAFieldLeavesTheNoticeAndTheTextAlone: Story = {
  beforeEach: keepNoticesOpen,
  play: async ({ canvas }) => {
    await undoShortcutArrived(canvas);
    await deleteFromTheList(canvas, "Garden work");
    await waitFor(() => expect(undoOffers()).toHaveLength(1));
    await userEvent.click(await canvas.findByRole("button", { name: "Studio work" }));
    const drawer = within(await settled(screen.findByRole("dialog", { name: "Studio work" })));
    const name = await drawer.findByRole("textbox", { name: "Name" });
    await userEvent.click(name);
    await expect(name).toHaveFocus();

    // Left to the browser means that it goes on to undo the typing.
    await expect(modKeyIsLeftToTheBrowser(name, "z")).toBe(true);
    // Under a loaded run the notice can still be sliding in.
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeVisible());

    await userEvent.click(drawer.getByRole("button", { name: "Cancel" }));
    await noDrawer();
    await undoLast();
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
    await expect(screen.queryByText("That could not be undone.")).toBeNull();
  },
};

export const AnOldLinkToADeletedEntrySaysItWasNotFound: Story = {
  args: {
    address: `${OVERVIEW}?edit=${STUDIO_WORK.id}`,
    access: placeholderAlphaAnswers({ list: { data: [GARDEN_WORK] } }),
  },
  play: async () => {
    const drawer = within(
      await settled(screen.findByRole("dialog", { name: "Placeholder Alpha" })),
    );
    await expect(await drawer.findByRole("alert")).toHaveTextContent("Entry not found");
    await userEvent.click(drawer.getByRole("button", { name: "Close" }));
    await noDrawer();
    await expect(openEntry()).toBeUndefined();
  },
};

export const AnUnknownEntrySaysSoAndOffersOnlyToClose: Story = {
  args: { address: `${OVERVIEW}?edit=no-such-entry` },
  play: async () => {
    const drawer = within(
      await settled(screen.findByRole("dialog", { name: "Placeholder Alpha" })),
    );
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
