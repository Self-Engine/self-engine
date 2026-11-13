import { useLingui } from "@lingui/react/macro";
import { Box, Center } from "@mantine/core";
import type { DataConnection } from "@self-engine/data-client";
import {
  ErrorState,
  NOT_WINDOW_DRAG_STYLE,
  notifyProgress,
  useWaitIsSlow,
  WINDOW_DRAG_STYLE,
} from "@self-engine/ui";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";

export interface DataConnectionStatesProps {
  readonly connection: Pick<DataConnection, "getState" | "subscribe">;
  /**
   * Asks the desktop app to start the stopped data process again. Absent in the browser, which has
   * no Data Process to start (D263).
   */
  readonly onRetry: (() => void) | undefined;
  /** The app, which stays mounted while the connection comes back. */
  readonly children: ReactNode;
}

/**
 * The app while its connection to the data process stands or comes back; in its place, the
 * reason when the data process cannot serve (spec #29). The web app, which has no data process,
 * shows the stopped state without a retry (D263).
 */
export function DataConnectionStates({ connection, onRetry, children }: DataConnectionStatesProps) {
  const { t } = useLingui();
  const state = useSyncExternalStore(connection.subscribe, connection.getState);
  switch (state.status) {
    case "migrationFailed": {
      const { migration } = state;
      return (
        <WholeWindow>
          <ErrorState
            description={t`This version of Self-Engine could not apply the update ${migration} to your data. It was undone, so your data is unchanged.`}
            title={t`Your data could not be updated.`}
          />
        </WholeWindow>
      );
    }
    case "databaseNewer": {
      const { migration } = state;
      return (
        <WholeWindow>
          <ErrorState
            description={t`A newer version already applied the update ${migration}, which this version does not know. Open your data with the newer version.`}
            title={t`Your data comes from a newer version of Self-Engine.`}
          />
        </WholeWindow>
      );
    }
    case "stopped":
      return (
        <WholeWindow>
          <ErrorState
            description={
              onRetry === undefined
                ? t`In the browser, Self-Engine has no access to your data yet. Open the desktop app to work with it.`
                : t`The part of Self-Engine that keeps your data stopped after it crashed several times.`
            }
            {...(onRetry && { onRetry })}
            title={t`Your data cannot be reached.`}
          />
        </WholeWindow>
      );
    default:
      // The app keeps its place in the tree, so a draft in a form survives a reconnect.
      return (
        <>
          {children}
          {state.status === "reconnecting" && <ReconnectingNotice />}
        </>
      );
  }
}

/** The window has no title bar of its own on macOS: without the Shell, the background moves it. */
function WholeWindow({ children }: { readonly children: ReactNode }) {
  return (
    <Center h="100dvh" style={WINDOW_DRAG_STYLE}>
      <Box style={NOT_WINDOW_DRAG_STYLE}>{children}</Box>
    </Center>
  );
}

/** Small and out of the way: the app stays usable, and its calls wait for the connection. */
function ReconnectingNotice() {
  const { t } = useLingui();
  const slow = useWaitIsSlow();
  const message = t`Reconnecting to your data…`;
  useEffect(() => {
    if (slow) return notifyProgress({ message });
    return undefined;
  }, [slow, message]);
  return null;
}
