import { TextInput } from "@mantine/core";
import type { ConnectionState } from "@self-engine/data-client";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { DataConnectionStates } from "./data-connection-states.tsx";
import { dataConnection } from "./desktop-data.ts";
import { settingsStore } from "./settings-store.ts";
import { AppAt } from "./story-app.tsx";

/** A connection whose state the story sets by hand, like the data process would. */
function storyConnection(initial: ConnectionState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    set(next: ConnectionState) {
      state = next;
      for (const listener of listeners) listener();
    },
  };
}

let connection = storyConnection({ status: "ready" });
const retry = fn();

/** The notice's wait, run when the story says so. */
let heldWait: ReturnType<typeof holdTimers>["held"];
const runTheWait = () => {
  for (const finish of heldWait.values()) finish();
};

/** Moves to reconnecting and waits until the notice's wait has begun. */
async function startReconnecting() {
  const before = heldWait.size;
  connection.set({ status: "reconnecting" });
  await waitFor(() => expect(heldWait.size).toBeGreaterThan(before));
}

function startingAt(state: ConnectionState) {
  return () => {
    connection = storyConnection(state);
    const timers = holdTimers(200);
    heldWait = timers.held;
    return timers.restore;
  };
}

const meta = {
  title: "App/Data connection states",
  parameters: { layout: "fullscreen" },
  render: () => (
    <DataConnectionStates connection={connection} onRetry={retry}>
      <TextInput label="Note" />
    </DataConnectionStates>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const MIGRATION_FAILED: ConnectionState = { status: "migrationFailed", migration: "time/0002" };
const DATABASE_NEWER: ConnectionState = { status: "databaseNewer", migration: "finance/0007" };

export const MigrationFailed: Story = {
  beforeEach: startingAt(MIGRATION_FAILED),
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Your data could not be updated");
    await expect(alert).toHaveTextContent("time/0002");
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.queryByRole("textbox")).toBeNull();
  },
};

export const MigrationFailedInGerman: Story = {
  beforeEach: startingAt(MIGRATION_FAILED),
  globals: { language: "de" },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Deine Daten konnten nicht aktualisiert werden");
    await expect(alert).toHaveTextContent("time/0002");
  },
};

export const DatabaseNewer: Story = {
  beforeEach: startingAt(DATABASE_NEWER),
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Your data comes from a newer version of Self-Engine");
    await expect(alert).toHaveTextContent("finance/0007");
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

export const DatabaseNewerInGerman: Story = {
  beforeEach: startingAt(DATABASE_NEWER),
  globals: { language: "de" },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Deine Daten stammen aus einer neueren Version");
    await expect(alert).toHaveTextContent("finance/0007");
  },
};

export const StoppedOffersToTryAgain: Story = {
  beforeEach: startingAt({ status: "stopped" }),
  play: async ({ canvas }) => {
    retry.mockClear();
    await expect(canvas.getByRole("alert")).toHaveTextContent("Your data cannot be reached");
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(retry).toHaveBeenCalledOnce();
  },
};

export const StoppedInGerman: Story = {
  beforeEach: startingAt({ status: "stopped" }),
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Deine Daten sind nicht erreichbar");
    await expect(canvas.getByRole("button", { name: "Erneut versuchen" })).toBeVisible();
  },
};

/** The notice's own element: it floats outside the canvas. */
const page = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

export const ReconnectingShowsANoticeAfterTheWait: Story = {
  beforeEach: startingAt({ status: "reconnecting" }),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("textbox", { name: "Note" })).toBeVisible();
    await expect(page(canvasElement).queryByText("Reconnecting to your data…")).toBeNull();
    runTheWait();
    const notice = await page(canvasElement).findByRole("status");
    await expect(notice).toHaveTextContent("Reconnecting to your data…");
  },
};

export const ReconnectingInGerman: Story = {
  beforeEach: startingAt({ status: "reconnecting" }),
  globals: { language: "de" },
  play: async ({ canvasElement }) => {
    runTheWait();
    const notice = await page(canvasElement).findByRole("status");
    await expect(notice).toHaveTextContent("Verbindung zu deinen Daten wird wiederhergestellt…");
  },
};

export const NoNoticeWhenTheConnectionIsBackWithinTheWait: Story = {
  beforeEach: startingAt({ status: "ready" }),
  play: async ({ canvasElement }) => {
    await startReconnecting();
    await expect(page(canvasElement).queryByRole("status")).toBeNull();
    connection.set({ status: "ready" });
    // Whatever wait is still held fires now, as if 200 ms had passed.
    runTheWait();
    await expect(page(canvasElement).queryByRole("status")).toBeNull();
  },
};

export const TypedTextSurvivesAReconnect: Story = {
  beforeEach: startingAt({ status: "ready" }),
  play: async ({ canvas, canvasElement }) => {
    const field = canvas.getByRole("textbox", { name: "Note" });
    await userEvent.type(field, "Half a sentence");

    await startReconnecting();
    runTheWait();
    await page(canvasElement).findByRole("status");
    connection.set({ status: "ready" });
    await waitFor(() => expect(page(canvasElement).queryByRole("status")).toBeNull());

    // The same element, so the Shell and its forms stayed mounted.
    await expect(canvas.getByRole("textbox", { name: "Note" })).toBe(field);
    await expect(field).toHaveValue("Half a sentence");
  },
};

/** Outside the desktop app nothing answers, and the app looks as it did before (D196). */
export const TheWebAppShowsNoConnectionState: Story = {
  loaders: [() => settingsStore.load()],
  beforeEach: () => {
    dataConnection.stop();
    // Back to waiting for a first port, as the web app's connection always is.
    return () => dataConnection.disconnect();
  },
  render: () => <AppAt address="/placeholder-alpha/overview" />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("navigation")).toBeVisible();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};
