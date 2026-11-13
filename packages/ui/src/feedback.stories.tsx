import { notifications } from "@mantine/notifications";
import { roleColor } from "@self-engine/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import {
  confirm,
  type ConfirmOptions,
  isConfirmationOpen,
  notifyError,
  notifyProgress,
  notifyUndoable,
  undoLatest,
} from "./index.ts";
import { holdTimers } from "./story-timers.ts";

const meta = {
  title: "UI/Feedback",
  render: () => <></>,
  // The notices live in Mantine's store, which outlives a story.
  beforeEach: () => notifications.clean(),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const QUESTION = {
  title: "Delete for good?",
  message: "This cannot be undone.",
  confirmLabel: "Delete",
};

async function ask(options: typeof QUESTION & Pick<ConfirmOptions, "danger"> = QUESTION) {
  const answer = confirm(options);
  const dialog = await screen.findByRole("dialog", { name: options.title });
  return { answer, dialog: within(dialog) };
}

const gone = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

export const ConfirmingAnswersYesFromOutsideAComponent: Story = {
  play: async () => {
    const { answer, dialog } = await ask();
    await waitFor(() => expect(dialog.getByText("This cannot be undone.")).toBeVisible());
    await userEvent.click(dialog.getByRole("button", { name: "Delete" }));
    await expect(await answer).toBe(true);
    await gone();
  },
};

export const AConfirmationIsKnownToBeOpenFromTheMomentItIsRaised: Story = {
  play: async () => {
    await expect(isConfirmationOpen()).toBe(false);
    const answer = confirm(QUESTION);
    // Before React has drawn it, because a key can be pressed at any moment.
    await expect(isConfirmationOpen()).toBe(true);
    const dialog = within(await screen.findByRole("dialog", { name: QUESTION.title }));
    await userEvent.click(dialog.getByRole("button", { name: "Delete" }));
    await expect(await answer).toBe(true);
    await expect(isConfirmationOpen()).toBe(false);
    await gone();
  },
};

export const AConfirmationIsNoLongerOpenAfterEsc: Story = {
  play: async () => {
    const { answer } = await ask();
    await expect(isConfirmationOpen()).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect(await answer).toBe(false);
    await expect(isConfirmationOpen()).toBe(false);
    await gone();
  },
};

export const CancellingAnswersNo: Story = {
  play: async () => {
    const { answer, dialog } = await ask();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(await answer).toBe(false);
    await gone();
  },
};

export const EscAnswersNo: Story = {
  play: async () => {
    const { answer } = await ask();
    await userEvent.keyboard("{Escape}");
    await expect(await answer).toBe(false);
    await gone();
  },
};

export const AClickBesideTheDialogAnswersNo: Story = {
  play: async () => {
    const { answer } = await ask();
    const beside = document.querySelector(".mantine-Modal-overlay");
    if (beside === null) throw new Error("the dialog has no area around it");
    await userEvent.click(beside);
    await expect(await answer).toBe(false);
    await gone();
  },
};

export const FocusStartsOnCancelSoAReflexiveEnterDoesNotConfirm: Story = {
  play: async () => {
    const { answer, dialog } = await ask();
    await waitFor(() => expect(dialog.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await expect(await answer).toBe(false);
    await gone();
  },
};

export const TheCancelButtonCanSayWhatItKeeps: Story = {
  play: async () => {
    const answer = confirm({ ...QUESTION, cancelLabel: "Keep editing" });
    const dialog = within(await screen.findByRole("dialog", { name: QUESTION.title }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Keep editing" })).toHaveFocus());
    await expect(dialog.queryByRole("button", { name: "Cancel" })).toBeNull();
    await userEvent.click(dialog.getByRole("button", { name: "Keep editing" }));
    await expect(await answer).toBe(false);
    await gone();
  },
};

export const TheCallerCanTakeOverWhereTheFocusGoes: Story = {
  render: () => <button>Before the question</button>,
  play: async ({ canvas }) => {
    const before = canvas.getByRole("button", { name: "Before the question" });
    before.focus();
    const answer = confirm({ ...QUESTION, returnFocus: false });
    await screen.findByRole("dialog", { name: QUESTION.title });
    await waitFor(() => expect(before).not.toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await expect(await answer).toBe(false);
    await gone();
    await expect(before).not.toHaveFocus();
  },
};

export const DangerUsesTheErrorColorRole: Story = {
  render: () => <span data-testid="error-role" style={{ backgroundColor: roleColor("error") }} />,
  play: async ({ canvas }) => {
    const { answer, dialog } = await ask({ ...QUESTION, danger: true });
    const button = dialog.getByRole("button", { name: "Delete" });
    await expect(getComputedStyle(button).backgroundColor).toBe(
      getComputedStyle(canvas.getByTestId("error-role")).backgroundColor,
    );
    await userEvent.click(button);
    await answer;
    await gone();
  },
};

const noticeGone = (text: string) => waitFor(() => expect(screen.queryByText(text)).toBeNull());

const noticeWith = async (text: string) => {
  const notice = (await screen.findByText(text)).closest<HTMLElement>('[role="alert"]');
  if (notice === null) throw new Error(`"${text}" is not in a notice`);
  return notice;
};

const undoButton = (notice: HTMLElement) => within(notice).getByRole("button", { name: "Undo" });

/** The timers a notice waits on, run when the story says so. */
let heldNoticeTimers: ReturnType<typeof holdTimers>["held"];

function holdNoticeTimers() {
  const timers = holdTimers(8000);
  heldNoticeTimers = timers.held;
  return timers.restore;
}

export const AnUndoableNoticeStaysEightSecondsAndPausesOnHover: Story = {
  beforeEach: holdNoticeTimers,
  play: async () => {
    const undo = fn();
    notifyUndoable({ message: "Entry deleted", undo });
    const notice = await noticeWith("Entry deleted");
    await waitFor(() => expect(heldNoticeTimers.size).toBe(1));

    await userEvent.hover(notice);
    await waitFor(() => expect(heldNoticeTimers.size).toBe(0));
    await userEvent.unhover(notice);
    await waitFor(() => expect(heldNoticeTimers.size).toBe(1));

    for (const run of heldNoticeTimers.values()) run();
    await noticeGone("Entry deleted");
    await expect(undo).not.toHaveBeenCalled();
  },
};

export const UndoHidesTheNoticeAtOnceAndRunsOnceOnADoubleClick: Story = {
  play: async () => {
    const undo = fn();
    notifyUndoable({ message: "Entry deleted", undo });
    const notice = await noticeWith("Entry deleted");
    await userEvent.dblClick(undoButton(notice));
    await expect(undo).toHaveBeenCalledOnce();
    await noticeGone("Entry deleted");
  },
};

export const ARejectedUndoIsReported: Story = {
  play: async () => {
    notifyUndoable({
      message: "Entry deleted",
      undo: () => Promise.reject(new Error("the store is gone")),
    });
    await userEvent.click(undoButton(await noticeWith("Entry deleted")));
    await noticeGone("Entry deleted");
    await expect(await noticeWith("That could not be undone.")).toBeVisible();
  },
};

export const TwoNoticesAreTakenBackSeparately: Story = {
  play: async () => {
    const undoFirst = fn();
    const undoSecond = fn();
    notifyUndoable({ message: "First deleted", undo: undoFirst });
    notifyUndoable({ message: "Second deleted", undo: undoSecond });
    const second = await noticeWith("Second deleted");
    const first = await noticeWith("First deleted");
    // The earlier notice lies behind the latest until the pointer fans the stack out.
    await expect(first).toHaveAttribute("inert");
    await userEvent.hover(second);
    await waitFor(() => expect(first).not.toHaveAttribute("inert"));

    await userEvent.click(undoButton(first));
    await expect(undoFirst).toHaveBeenCalledOnce();
    await expect(undoSecond).not.toHaveBeenCalled();
    await noticeGone("First deleted");
    await expect(second).toBeVisible();

    await userEvent.click(undoButton(second));
    await expect(undoSecond).toHaveBeenCalledOnce();
    await noticeGone("Second deleted");
  },
};

export const UndoLatestTakesBackTheMostRecentNoticeFirst: Story = {
  play: async () => {
    const undoFirst = fn();
    const undoSecond = fn();
    notifyUndoable({ message: "First deleted", undo: undoFirst });
    notifyUndoable({ message: "Second deleted", undo: undoSecond });
    const first = await noticeWith("First deleted");

    undoLatest();
    await expect(undoSecond).toHaveBeenCalledOnce();
    await expect(undoFirst).not.toHaveBeenCalled();
    await noticeGone("Second deleted");
    await expect(first).toBeVisible();

    undoLatest();
    await expect(undoFirst).toHaveBeenCalledOnce();
    await noticeGone("First deleted");
  },
};

export const UndoLatestSkipsANoticeThatIsStillSlidingOut: Story = {
  play: async () => {
    const undoFirst = fn();
    const undoSecond = fn();
    notifyUndoable({ message: "First deleted", undo: undoFirst });
    notifyUndoable({ message: "Second deleted", undo: undoSecond });
    await noticeWith("Second deleted");

    undoLatest();
    undoLatest();
    await expect(undoSecond).toHaveBeenCalledOnce();
    await expect(undoFirst).toHaveBeenCalledOnce();
    await noticeGone("First deleted");
    await noticeGone("Second deleted");
  },
};

export const UndoLatestSkipsANoticeThatClosedByItself: Story = {
  beforeEach: holdNoticeTimers,
  play: async () => {
    const undoFirst = fn();
    const undoSecond = fn();
    notifyUndoable({ message: "First deleted", undo: undoFirst });
    await noticeWith("First deleted");
    await waitFor(() => expect(heldNoticeTimers.size).toBe(1));
    notifyUndoable({ message: "Second deleted", undo: undoSecond });
    await noticeWith("Second deleted");
    // Only the latest notice counts down; the one behind it waits for its turn.
    await waitFor(() => expect(heldNoticeTimers.size).toBe(1));

    [...heldNoticeTimers.values()].at(-1)!();
    await noticeGone("Second deleted");

    undoLatest();
    await expect(undoSecond).not.toHaveBeenCalled();
    await expect(undoFirst).toHaveBeenCalledOnce();
    await noticeGone("First deleted");
  },
};

export const UndoLatestLeavesEveryOtherNoticeAlone: Story = {
  play: async () => {
    notifyError({ message: "The backup failed." });
    const notice = await noticeWith("The backup failed.");
    undoLatest();
    await expect(notice).toBeVisible();
    await userEvent.click(within(notice).getByRole("button", { name: "Close notice" }));
    await noticeGone("The backup failed.");
  },
};

export const AnErrorNoticeSaysWhatFailed: Story = {
  play: async () => {
    notifyError({ message: "The backup failed." });
    const notice = await noticeWith("The backup failed.");
    await expect(within(notice).queryByRole("button", { name: "Undo" })).toBeNull();
  },
};

export const NoticesSitTopRight: Story = {
  play: async () => {
    notifyError({ message: "The backup failed." });
    const notice = await noticeWith("The backup failed.");
    await waitFor(async () => {
      const { right, top } = notice.getBoundingClientRect();
      await expect(window.innerWidth - right).toBeLessThan(40);
      await expect(top).toBeLessThan(40);
    });
  },
};

export const OnlyTheLatestNoticeCountsDown: Story = {
  beforeEach: holdNoticeTimers,
  play: async () => {
    notifyError({ message: "The backup failed." });
    await noticeWith("The backup failed.");
    notifyError({ message: "The export failed." });
    await noticeWith("The export failed.");
    await waitFor(() => expect(heldNoticeTimers.size).toBe(1));
    for (const run of heldNoticeTimers.values()) run();
    await noticeGone("The export failed.");
    // The one behind comes forward and gets its full time.
    await waitFor(() => expect(heldNoticeTimers.size).toBe(1));
    await expect(await noticeWith("The backup failed.")).not.toHaveAttribute("inert");
  },
};

export const ANoticeCanBeClosedByItsNamedButton: Story = {
  play: async () => {
    notifyError({ message: "The backup failed." });
    const notice = await noticeWith("The backup failed.");
    await userEvent.click(within(notice).getByRole("button", { name: "Close notice" }));
    await noticeGone("The backup failed.");
  },
};

export const TheirOwnTextIsTranslated: Story = {
  globals: { language: "de" },
  play: async () => {
    notifyUndoable({ message: "Entry deleted", undo: fn() });
    const notice = await noticeWith("Entry deleted");
    await expect(within(notice).getByRole("button", { name: "Rückgängig" })).toBeVisible();
    await expect(within(notice).getByRole("button", { name: "Hinweis schließen" })).toBeVisible();

    const answer = confirm(QUESTION);
    const dialog = within(await screen.findByRole("dialog", { name: QUESTION.title }));
    await userEvent.click(dialog.getByRole("button", { name: "Abbrechen" }));
    await expect(await answer).toBe(false);
  },
};

function preferReducedMotion() {
  const realMatchMedia = window.matchMedia.bind(window);
  const media = spyOn(window, "matchMedia").mockImplementation((query) =>
    query.includes("prefers-reduced-motion")
      ? ({
          matches: true,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        } as unknown as MediaQueryList)
      : realMatchMedia(query),
  );
  return () => media.mockRestore();
}

export const ReducedMotionStillsTheDialogAndTheNotices: Story = {
  beforeEach: preferReducedMotion,
  play: async () => {
    notifyError({ message: "The backup failed." });
    const notice = await noticeWith("The backup failed.");
    await expect(notice.style.transitionDuration).toBe("1ms, 1ms");

    const answer = confirm(QUESTION);
    const dialog = await screen.findByRole("dialog", { name: QUESTION.title });
    await expect(getComputedStyle(dialog).transitionDuration).toBe("0s");
    await userEvent.keyboard("{Escape}");
    await answer;
    await gone();
  },
};

export const ProgressStaysUntilTheCallerHidesIt: Story = {
  beforeEach: holdNoticeTimers,
  play: async () => {
    const hide = notifyProgress({ message: "Saving your data…" });
    const notice = await screen.findByRole("status");
    await expect(notice).toHaveTextContent("Saving your data…");
    await expect(notice.querySelector(".mantine-Loader-root")).not.toBeNull();
    await expect(within(notice).queryByRole("button")).toBeNull();
    await expect(heldNoticeTimers.size).toBe(0);
    hide();
    await noticeGone("Saving your data…");
  },
};
