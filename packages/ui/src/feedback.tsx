import "@mantine/notifications/styles.css";

import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Group, MantineThemeProvider } from "@mantine/core";
import { modals, ModalsProvider } from "@mantine/modals";
import { notifications, Notifications } from "@mantine/notifications";
import { roleColor } from "@self-engine/theme";
import type { CSSProperties, ReactNode } from "react";

const NOTICE_MS = 8000;

/** The height of a bar fixed to the bottom of the window. Whoever draws such a bar sets it. */
export const NOTICE_CLEARANCE_VARIABLE = "--self-engine-notice-clearance";

/** Only the bottom-right container is in use, and the margin lifts it. */
const CLEAR_OF_THE_BOTTOM_BAR: CSSProperties = {
  marginBottom: `var(${NOTICE_CLEARANCE_VARIABLE}, 0rem)`,
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
          position="bottom-right"
          style={CLEAR_OF_THE_BOTTOM_BAR}
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
      onClose: () => setTimeout(() => resolve(false)),
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

/** Reports something that already happened and offers to take it back. */
export function notifyUndoable({ message, undo }: NotifyUndoableOptions) {
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
  });
}
