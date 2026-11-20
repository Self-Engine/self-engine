import "@mantine/notifications/styles.css";

import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Group, List, MantineThemeProvider, Stack } from "@mantine/core";
import { modals, ModalsProvider } from "@mantine/modals";
import { notifications, Notifications, notificationsStore } from "@mantine/notifications";
import { roleColor } from "@self-engine/theme";
import type { CSSProperties, ReactNode } from "react";

const NOTICE_MS = 8000;

/**
 * Where the notices start, from the top of the window: below what sits there and must stay
 * clickable. Whoever draws it sets it; without it, Mantine's own distance applies.
 */
export const NOTICE_CLEARANCE_VARIABLE = "--self-engine-notice-clearance";

const MANTINE_TOP = "var(--mantine-spacing-md)";

/**
 * Only the top-center container is in use. Mantine sets its `top`, so the margin adds what is
 * missing to reach the clearance. A margin and not `top`: the style reaches the bottom containers
 * too, and a `top` would stretch those over the window.
 */
const CLEAR_OF_THE_TOP: CSSProperties = {
  marginTop: `calc(var(${NOTICE_CLEARANCE_VARIABLE}, ${MANTINE_TOP}) - ${MANTINE_TOP})`,
};

/** Below the theme and above the routes, once per app: what it shows outlives a navigation. */
export function FeedbackHost({ children }: { readonly children: ReactNode }) {
  const { t } = useLingui();
  // A notice is created outside React and cannot translate its own close button.
  const translatedNoticeClose = {
    components: {
      Notification: { defaultProps: { closeButtonProps: { "aria-label": t`Close notice` } } },
    },
  };
  return (
    <ModalsProvider labels={{ confirm: "", cancel: t`Cancel` }}>
      <MantineThemeProvider inherit theme={translatedNoticeClose}>
        <Notifications
          autoClose={NOTICE_MS}
          // Only the latest notice shows in full; the others fan out while the pointer is on them.
          layout="stacked"
          position="top-center"
          style={CLEAR_OF_THE_TOP}
          // A line fills up until the notice closes, so the time left to undo shows.
          withAutoCloseProgress
        />
      </MantineThemeProvider>
      {children}
    </ModalsProvider>
  );
}

export interface ConfirmOptions {
  readonly title: ReactNode;
  readonly message: ReactNode;
  readonly confirmLabel: ReactNode;
  /** Says what the safe answer keeps. "Cancel" where left out. */
  readonly cancelLabel?: ReactNode;
  /** For an action that cannot be taken back. */
  readonly danger?: boolean;
  /** False when the caller decides where the focus goes after the answer. */
  readonly returnFocus?: boolean;
}

let openConfirmations = 0;

/** Whether a question is waiting for its answer, right now and whoever asked it. */
export const isConfirmationOpen = () => openConfirmations > 0;

/** Asks a yes-or-no question from anywhere, also outside a component. */
export function confirm({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  returnFocus = true,
}: ConfirmOptions) {
  return new Promise<boolean>((resolve) => {
    // Counted here and not read from Mantine's state, which only exists once React has drawn it.
    openConfirmations += 1;
    modals.openConfirmModal({
      title,
      returnFocus,
      children: message,
      confirmProps: {
        children: confirmLabel,
        ...(danger && { color: roleColor("error"), c: roleColor("onError") }),
      },
      cancelProps: { "data-autofocus": true, ...(cancelLabel && { children: cancelLabel }) },
      onConfirm: () => resolve(true),
      // Mantine reports Esc and a click beside the dialog only here. After a confirmation it
      // comes second, and the answer is already given. Esc goes on to the other listeners on the
      // window, and the browser lets React run between them, so answering in a later task keeps
      // whatever stands behind the question from seeing it gone and acting on the same key press.
      onClose: () => {
        openConfirmations -= 1;
        setTimeout(() => resolve(false));
      },
    });
  });
}

export interface NotifyErrorOptions {
  readonly message: ReactNode;
}

/** Tells the user that something failed. */
export function notifyError({ message }: NotifyErrorOptions) {
  notifications.show({ message, color: roleColor("error") });
}

export interface NotifyDoneOptions {
  readonly message: ReactNode;
}

/**
 * Tells the user that what they asked for happened, where nothing on screen shows it by itself
 * and there is nothing to take back. What can be taken back uses `notifyUndoable`.
 */
export function notifyDone({ message }: NotifyDoneOptions) {
  notifications.show({ message, role: "status" });
}

export interface NotifyProgressOptions {
  readonly message: ReactNode;
}

/** Shows ongoing work until the caller invokes the returned hide function. */
export function notifyProgress({ message }: NotifyProgressOptions): () => void {
  const id = notifications.show({
    message,
    loading: true,
    withCloseButton: false,
    autoClose: false,
    role: "status",
  });
  return () => notifications.hide(id);
}

export interface NotifyUndoableOptions {
  readonly message: ReactNode;
  readonly undo: () => Promise<void> | void;
}

async function runUndo(undo: NotifyUndoableOptions["undo"]) {
  try {
    await undo();
  } catch {
    // The user is told. Why it failed is the module's to log, since only the module knows.
    notifyError({ message: <Trans>That could not be undone.</Trans> });
  }
}

/** One way out a notice offers, such as "Archive" beside a refused delete. */
export interface NoticeAction {
  readonly label: ReactNode;
  readonly run: () => void;
}

export interface NotifyRefusedOptions {
  /** The entry the refused change concerns, by the name the person knows it by. */
  readonly entry?: ReactNode;
  /** Why it was refused: one text for each Reason, at least one. */
  readonly reasons: readonly [ReactNode, ...ReactNode[]];
  /** One way out; the notice closes when it is taken. */
  readonly action?: NoticeAction;
}

/**
 * A guard for the buttons of one notice: the first one taken hides it and runs, every later one
 * does nothing. The notice stays clickable while it slides out, so the second click of a double
 * click lands.
 */
function answerOnce(hide: () => void) {
  let answered = false;
  return {
    answered: () => answered,
    take: (run?: () => void) => {
      if (answered) return;
      answered = true;
      hide();
      run?.();
    },
  };
}

/** The buttons of a notice's ways out, at its end. */
function NoticeActions({
  actions,
  take,
}: {
  readonly actions: readonly NoticeAction[];
  readonly take: (run: () => void) => void;
}) {
  return (
    <Group justify="flex-end" gap="xs">
      {actions.map(({ label, run }, index) => (
        // The actions have no identity of their own and never change order.
        <Button key={index} onClick={() => take(run)} size="compact-sm" variant="subtle">
          {label}
        </Button>
      ))}
    </Group>
  );
}

/**
 * Tells the user that a change was refused and nothing happened (D334): the entry, then every
 * Reason. In the warning colors, since a Refusal is an answer and not a fault, and never with
 * "Undo", since there is nothing to take back.
 */
export function notifyRefused({ entry, reasons, action }: NotifyRefusedOptions) {
  const answer = answerOnce(() => notifications.hide(id));
  const id = notifications.show({
    title: entry,
    color: roleColor("warning"),
    message: (
      <Stack gap="xs">
        {reasons.length === 1 ? (
          reasons[0]
        ) : (
          <List size="sm">
            {reasons.map((reason, index) => (
              // The texts have no identity of their own and never change order.
              <List.Item key={index}>{reason}</List.Item>
            ))}
          </List>
        )}
        {action && <NoticeActions actions={[action]} take={answer.take} />}
      </Stack>
    ),
  });
}

export interface NotifyChoiceOptions {
  readonly message: ReactNode;
  /** The answers, the one most people take first. Taking one closes the notice. */
  readonly actions: readonly [NoticeAction, ...NoticeAction[]];
  /** The user closed the notice without an answer. */
  readonly onClosed?: () => void;
}

/**
 * Offers a choice the user may also leave unanswered, such as switching to the device's Time
 * Zone. It waits for an answer: no timer closes it. Returns the function that withdraws it, for a
 * caller that learns that the choice no longer stands; that runs nothing.
 */
export function notifyChoice({ message, actions, onClosed }: NotifyChoiceOptions): () => void {
  const answer = answerOnce(() => notifications.hide(id));
  const id = notifications.show({
    message: (
      <Stack gap="xs">
        {message}
        <NoticeActions actions={actions} take={answer.take} />
      </Stack>
    ),
    autoClose: false,
    role: "status",
    // Mantine reports every hide here, also one after an answer or a withdrawal.
    onClose: () => answer.take(onClosed),
  });
  return () => answer.take();
}

/** What each open undoable notice would do if taken back, by the id of the notice. */
const undoOffers = new Map<string, () => void>();

/**
 * Reports something that already happened and offers to take it back. Returns the function that
 * withdraws the offer, for a caller that learns that it can no longer be taken back.
 */
export function notifyUndoable({ message, undo }: NotifyUndoableOptions): () => void {
  let taken = false;
  const takeBack = () => {
    // The notice stays clickable while it slides out, so the second click of a double click lands.
    if (taken) return;
    taken = true;
    notifications.hide(id);
    void runUndo(undo);
  };
  const id = notifications.show({
    message: (
      <Group justify="space-between" wrap="nowrap">
        {message}
        <Button onClick={takeBack} size="compact-sm" variant="subtle">
          <Trans>Undo</Trans>
        </Button>
      </Group>
    ),
    onClose: () => undoOffers.delete(id),
  });
  undoOffers.set(id, takeBack);
  return () => {
    // The notice stays clickable while it slides out: its Undo does nothing from now on.
    taken = true;
    notifications.hide(id);
  };
}

/**
 * Takes back the most recent undoable notice on screen, and does nothing when there is none.
 * Asks Mantine's store what is on screen: a notice leaves it the moment it is hidden, even while
 * it still slides out, and a notice that is queued behind the limit has not been shown yet.
 */
export function undoLatest() {
  const latest = notificationsStore
    .getState()
    .notifications.findLast(({ id }) => id !== undefined && undoOffers.has(id));
  if (latest?.id !== undefined) undoOffers.get(latest.id)?.();
}
