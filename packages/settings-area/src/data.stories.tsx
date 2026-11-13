import type { PortAccess } from "@self-engine/data-client/react";
import { LOADER_DELAY_MS } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { storyViewPage } from "./story-page.tsx";
import { loadedStoreOn, memoryStorage } from "./story-store.ts";
import {
  BEFORE_RESTORE_BACKUP,
  type BackupAnswers,
  backupAnswers,
  DAILY_BACKUP,
  MANUAL_BACKUP,
  SAMPLE_BACKUPS,
} from "./testing/index.ts";

interface Call {
  readonly entry: string;
  readonly input: unknown;
}

interface Loaded {
  readonly Page: ComponentType;
  /** Every call the page made to `backups`, in order. */
  readonly calls: Call[];
}

/** The Fixed Answers, with every call written down: a story shows what the rows asked for. */
function recording(access: PortAccess, calls: Call[]): PortAccess {
  return {
    ...access,
    call(module, entry, input, signal) {
      calls.push({ entry, input });
      return access.call(module, entry, input, signal);
    },
  };
}

/**
 * The View Data on Fixed Answers (D255): each story fixes what `backups` answers. An Operation
 * changes nothing there, so the restart of the Data Process after a restore is not shown; the
 * desktop app's tests run the round trip over real files.
 */
const meta = {
  title: "Settings area/Data",
  beforeEach: clearNotices,
  loaders: [
    async ({ parameters }): Promise<Loaded> => {
      const store = await loadedStoreOn(memoryStorage());
      const calls: Call[] = [];
      const answers = parameters["answers"] as BackupAnswers | undefined;
      const access = recording(backupAnswers(answers), calls);
      return { calls, Page: storyViewPage("data", { store, access }) };
    },
  ],
  render: (_args, { loaded }) => {
    const { Page } = loaded as Loaded;
    return <Page />;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const callsOf = (loaded: unknown) => (loaded as Loaded).calls;
const entries = (loaded: unknown) => callsOf(loaded).map(({ entry }) => entry);

/** A Backup's time as the page writes it: in the language shown and this device's time zone. */
const timeOf = ({ takenAt }: { readonly takenAt: string }, locale = "en") =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(takenAt),
  );

const noticeWith = (text: string) => screen.findByText(text);

export const TheBackupsAreListedNewestFirstWithTheirReason: Story = {
  parameters: { answers: { list: { data: SAMPLE_BACKUPS } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Backups")).toBeVisible();
    const list = await canvas.findByRole("list", { name: "Restore a backup" });
    const lines = within(list).getAllByRole("listitem");
    await expect(lines.map((line) => line.textContent)).toEqual([
      `${timeOf(BEFORE_RESTORE_BACKUP)}Before a restore · 2.2 MBRestore`,
      `${timeOf(MANUAL_BACKUP)}Created by you · 2.2 MBRestore`,
      `${timeOf(DAILY_BACKUP)}Daily backup · 2.1 MBRestore`,
      `${timeOf(SAMPLE_BACKUPS[3]!)}Before an update · 812 kBRestore`,
    ]);
    // Every button says which Backup it restores.
    await expect(
      within(list).getByRole("button", { name: `Restore the backup from ${timeOf(DAILY_BACKUP)}` }),
    ).toBeVisible();
  },
};

export const WithoutABackupTheRowSaysSo: Story = {
  parameters: { answers: { list: { data: [] } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("There is no backup yet.")).toBeVisible();
    await expect(canvas.queryByRole("list")).toBeNull();
    await expect(canvas.getByRole("button", { name: "Create backup now" })).toBeEnabled();
  },
};

export const ANewBackupIsConfirmedAndTheListIsReadAgain: Story = {
  play: async ({ canvas, loaded }) => {
    await canvas.findByRole("list", { name: "Restore a backup" });
    await expect(entries(loaded)).toEqual(["list"]);
    const create = canvas.getByRole("button", { name: "Create backup now" });
    await expect(create).toHaveAccessibleDescription("Backups");

    await userEvent.click(create);

    await expect(await noticeWith("Backup created.")).toBeVisible();
    // No Table Change names a Backup, so the row reloads the list itself.
    await waitFor(() => expect(entries(loaded)).toEqual(["list", "create", "list"]));
  },
};

export const ABackupThatFailsIsAnnounced: Story = {
  parameters: { answers: { create: "unexpected" } },
  play: async ({ canvas, loaded }) => {
    await canvas.findByRole("list", { name: "Restore a backup" });

    await userEvent.click(canvas.getByRole("button", { name: "Create backup now" }));

    await expect(
      await noticeWith("Something went wrong, and the change was not saved."),
    ).toBeVisible();
    await expect(screen.queryByText("Backup created.")).toBeNull();
    await expect(entries(loaded)).toEqual(["list", "create"]);
    await expect(canvas.getByRole("button", { name: "Create backup now" })).toBeEnabled();
  },
};

const restoreButton = (canvas: ReturnType<typeof within>, backup: { readonly takenAt: string }) =>
  canvas.findByRole("button", { name: `Restore the backup from ${timeOf(backup)}` });

export const ARestoreIsConfirmedAndCanBeTakenBack: Story = {
  play: async ({ canvas, loaded }) => {
    await userEvent.click(await restoreButton(canvas, DAILY_BACKUP));

    const notice = await noticeWith("Backup restored.");
    await expect(notice).toBeVisible();
    await expect(callsOf(loaded).at(-1)).toEqual({
      entry: "restore",
      input: { id: DAILY_BACKUP.id },
    });
    // Nobody was asked first: what the restore replaced is a Backup, and Undo restores it.
    await expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() =>
      expect(callsOf(loaded).at(-1)).toEqual({
        entry: "restore",
        input: { id: BEFORE_RESTORE_BACKUP.id },
      }),
    );
  },
};

export const WhileABackupIsRestoredNoOtherCanBeStarted: Story = {
  parameters: { answers: { restore: "loading" } },
  play: async ({ canvas }) => {
    const daily = await restoreButton(canvas, DAILY_BACKUP);

    await userEvent.click(daily);

    await waitFor(() => expect(daily).toHaveAttribute("data-loading", "true"));
    await expect(await restoreButton(canvas, MANUAL_BACKUP)).toBeDisabled();
    await expect(screen.queryByText("Backup restored.")).toBeNull();
  },
};

export const ABackupThatCannotBeReadIsAnnouncedAndNothingIsRestored: Story = {
  parameters: { answers: { restore: { conflict: "backup_unreadable" } } },
  play: async ({ canvas }) => {
    await userEvent.click(await restoreButton(canvas, DAILY_BACKUP));

    await expect(
      await noticeWith("This backup can no longer be read. Nothing was restored."),
    ).toBeVisible();
    await expect(screen.queryByText("Backup restored.")).toBeNull();
    await expect(await restoreButton(canvas, DAILY_BACKUP)).toBeEnabled();
  },
};

export const ABackupThatIsGoneIsAnnouncedAndTheListIsReadAgain: Story = {
  parameters: { answers: { restore: "notFound" } },
  play: async ({ canvas, loaded }) => {
    await userEvent.click(await restoreButton(canvas, DAILY_BACKUP));

    await expect(await noticeWith("This entry no longer exists.")).toBeVisible();
    await waitFor(() => expect(entries(loaded)).toEqual(["list", "restore", "list"]));
  },
};

export const ARestoreThatFailsIsAnnounced: Story = {
  parameters: { answers: { restore: "unexpected" } },
  play: async ({ canvas }) => {
    await userEvent.click(await restoreButton(canvas, DAILY_BACKUP));

    await expect(
      await noticeWith("Something went wrong, and the change was not saved."),
    ).toBeVisible();
    await expect(screen.queryByText("Backup restored.")).toBeNull();
  },
};

export const AListThatCannotBeLoadedOffersAnotherTry: Story = {
  parameters: { answers: { list: "unexpected" } },
  play: async ({ canvas, loaded }) => {
    const failed = await canvas.findByRole("alert");
    await expect(failed).toHaveTextContent("This part could not be loaded.");
    // Taking a Backup does not depend on the list.
    await expect(canvas.getByRole("button", { name: "Create backup now" })).toBeEnabled();

    await userEvent.click(within(failed).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(entries(loaded)).toEqual(["list", "list"]));
  },
};

/** The loading state's wait, run when the story says so. */
let heldWait: ReturnType<typeof holdTimers>["held"];

export const ASlowListShowsThatItLoadsAfterItsWait: Story = {
  parameters: { answers: { list: "loading" } },
  beforeEach: () => {
    const timers = holdTimers(LOADER_DELAY_MS);
    heldWait = timers.held;
    return timers.restore;
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Restore a backup")).toBeVisible();
    await expect(canvas.queryByRole("status", { name: "Loading" })).toBeNull();
    await waitFor(() => expect(heldWait.size).toBeGreaterThan(0));
    for (const finish of heldWait.values()) finish();
    await expect(await canvas.findByRole("status", { name: "Loading" })).toBeVisible();
  },
};

export const TheSearchFindsTheRowsByWhatTheyDo: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("searchbox", { name: "Search settings" }), "recover");

    const hits = within(canvas.getByRole("region", { name: "Data" }));
    await expect(hits.getByText("Restore a backup")).toBeVisible();
    await expect(hits.queryByText("Backups")).toBeNull();
    // A hit is the working row, with its list.
    await expect(await restoreButton(hits, DAILY_BACKUP)).toBeEnabled();
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Sicherungen")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Sicherung jetzt erstellen" })).toBeVisible();
    const list = await canvas.findByRole("list", { name: "Sicherung wiederherstellen" });
    await expect(
      within(list)
        .getAllByRole("listitem")
        .map((line) => line.textContent),
    ).toEqual([
      `${timeOf(MANUAL_BACKUP, "de")}Von dir erstellt · 2,2 MBWiederherstellen`,
      `${timeOf(DAILY_BACKUP, "de")}Tägliche Sicherung · 2,1 MBWiederherstellen`,
      `${timeOf(SAMPLE_BACKUPS[3]!, "de")}Vor einem Update · 812 kBWiederherstellen`,
    ]);
    await expect(
      within(list).getByRole("button", {
        name: `Sicherung vom ${timeOf(DAILY_BACKUP, "de")} wiederherstellen`,
      }),
    ).toBeVisible();
  },
};
