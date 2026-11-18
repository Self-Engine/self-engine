// The shared Notice of a Refusal (D334), shown by the Operation hook for a refused delete of a
// note of the `notes` test module. The texts are composed as the app composes them: the frame's,
// and the module's own for its Reason `pinned`, written here in its stead.

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Button, Group } from "@mantine/core";
import { referenced, targetDeleted } from "@self-engine/data-protocol";
import { activateLanguage } from "@self-engine/i18n";
import { notesContract, pinnedNote } from "@self-engine/storage/testing/contracts";
import { notesTableNames } from "@self-engine/storage/testing/table-names";
import { clearNotices } from "@self-engine/ui/story-notices";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { fixedAnswers } from "../testing/index.ts";
import {
  DataProvider,
  portHooks,
  type ReasonText,
  type RefusalAction,
  refusalTexts,
} from "./index.ts";

const notesPort = portHooks<typeof notesContract>("notes");
const useDeleteNote = notesPort.operation("delete");

const NOTE_ID = "019a7c4e-0000-7000-8000-000000000001";

/** The `notes` module's text for its own Reason, with its details typed. */
const pinnedText: ReasonText<typeof pinnedNote> = ({ details }) =>
  `“${details.title}” is pinned. Unpin it first.`;

const texts = refusalTexts([{ pinned: pinnedText }], (table) =>
  table === "notes" ? notesTableNames.notes : undefined,
);

const REFERENCED = {
  code: "referenced" as const,
  table: "notes",
  row: NOTE_ID,
  details: {
    tables: [
      { table: "notes", count: 12 },
      { table: "note_links", count: 1 },
    ],
  },
};
const PINNED = {
  code: "pinned" as const,
  table: "notes",
  row: NOTE_ID,
  details: { title: "Groceries" },
};

// The label of the way out `projects` will offer; a story's own text has no translation.
const ARCHIVE = msg({ message: "Archive", context: "Archive a project" });

interface DeleteProps {
  /** Whether the note is pinned as well as referred to: a Refusal with two Reasons. */
  readonly pinned?: boolean;
  readonly action?: RefusalAction["run"];
}

/** A button that deletes the note "Groceries", which the Fixed Answers refuse. */
function DeleteGroceries({ pinned = false, action }: DeleteProps) {
  const [access] = useState(() =>
    fixedAnswers(
      { notes: notesContract },
      { notes: { delete: { refused: pinned ? [REFERENCED, PINNED] : [REFERENCED] } } },
      { reasons: [referenced, targetDeleted, pinnedNote] },
    ),
  );
  return (
    <DataProvider access={access} reasonTexts={texts}>
      <DeleteButton {...(action && { action })} />
    </DataProvider>
  );
}

function DeleteButton({ action }: Pick<DeleteProps, "action">) {
  const { i18n } = useLingui();
  const remove = useDeleteNote();
  return (
    <Group>
      <Button
        onClick={() => {
          void remove.run(
            { id: NOTE_ID as never },
            { entry: "Groceries", ...(action && { action: { label: ARCHIVE, run: action } }) },
          );
        }}
      >
        Delete Groceries
      </Button>
      {/* The App Language switched as the Settings switch it. */}
      <Button onClick={() => void activateLanguage(i18n, "de")} variant="default">
        Deutsch
      </Button>
    </Group>
  );
}

const meta = {
  title: "Data/Refusal Notice",
  component: DeleteGroceries,
  globals: { language: "en" },
  // The notices live in Mantine's store, which outlives a story; they stay until the story ends.
  beforeEach: () => {
    clearNotices();
    return holdTimers(8000).restore;
  },
} satisfies Meta<typeof DeleteGroceries>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Deletes "Groceries" and returns the Notice that tells why it was refused. */
async function refuse() {
  await userEvent.click(screen.getByRole("button", { name: "Delete Groceries" }));
  const title = await screen.findByText("Groceries");
  const notice = title.closest<HTMLElement>(".mantine-Notification-root");
  if (notice === null) throw new Error("The Refusal has no Notice");
  return within(notice);
}

export const OneReason: Story = {
  args: {},
  play: async () => {
    const notice = await refuse();
    // The Notice slides in.
    await waitFor(() =>
      expect(
        notice.getByText("Cannot be deleted: 12 notes and 1 entry refer to it."),
      ).toBeVisible(),
    );
    // Nothing happened, so there is nothing to undo.
    await expect(notice.queryByRole("button", { name: "Undo" })).toBeNull();
  },
};

export const SeveralReasonsAreAllListed: Story = {
  args: { pinned: true },
  play: async () => {
    const notice = await refuse();
    const reasons = notice.getAllByRole("listitem").map((item) => item.textContent);
    await expect(reasons).toEqual([
      "Cannot be deleted: 12 notes and 1 entry refer to it.",
      "“Groceries” is pinned. Unpin it first.",
    ]);
    await expect(notice.queryByRole("button", { name: "Undo" })).toBeNull();
  },
};

export const APageAddsOneAction: Story = {
  args: { action: fn() },
  play: async ({ args }) => {
    const notice = await refuse();
    await userEvent.click(notice.getByRole("button", { name: "Archive" }));
    await expect(args.action).toHaveBeenCalledTimes(1);
    // Taking the way out closes the Notice.
    await waitFor(() => expect(screen.queryByText("Groceries")).toBeNull());
  },
};

export const TheTextsFollowALanguageSwitch: Story = {
  args: { action: fn() },
  play: async () => {
    const notice = await refuse();
    await userEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    await expect(
      await notice.findByText(
        "Lässt sich nicht löschen: 12 Notizen und 1 Eintrag verweisen darauf.",
      ),
    ).toBeVisible();
    await expect(notice.getByRole("button", { name: "Archivieren" })).toBeVisible();
  },
};
