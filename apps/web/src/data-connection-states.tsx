import { useLingui } from "@lingui/react/macro";
import { Affix, Box, Center, Notification, rem } from "@mantine/core";
import type { DataConnection } from "@self-engine/data-client";
import { ErrorState, useWaitIsSlow } from "@self-engine/ui";
import { type CSSProperties, type ReactNode, useSyncExternalStore } from "react";

// The window has no title bar of its own on macOS: without the Shell, the background moves it.
const WINDOW_DRAG_STYLE = { WebkitAppRegion: "drag" } as CSSProperties;
const NOT_WINDOW_DRAG_STYLE = { WebkitAppRegion: "no-drag" } as CSSProperties;

const NOTICE_POSITION = { top: rem(12), left: "50%" };
const NOTICE_STYLE: CSSProperties = { transform: "translateX(-50%)" };

export interface DataConnectionStatesProps {
  readonly connection: Pick<DataConnection, "getState" | "subscribe">;
  /** Asks the desktop app to start the stopped data process again. */
  readonly onRetry: () => void;
  /** The app, which stays mounted while the connection comes back. */
  readonly children: ReactNode;
}

/**
 * The app while its connection to the data process stands or comes back; in its place, the
 * reason when the data process cannot serve (spec #29). Only the desktop app renders this.
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
            description={t`The part of Self-Engine that keeps your data stopped after it crashed several times.`}
            onRetry={onRetry}
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
  if (!slow) return null;
  return (
    <Affix position={NOTICE_POSITION} style={NOTICE_STYLE}>
      <Notification loading role="status" withCloseButton={false}>
        {t`Reconnecting to your data…`}
      </Notification>
    </Affix>
  );
}
