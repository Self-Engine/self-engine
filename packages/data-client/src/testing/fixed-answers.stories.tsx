// Fixed Answers (D255) shown on a small View of the `notes` test module: the View reads and
// renames notes through Port hooks, and each story fixes what the entries answer. The View is a
// demonstration of the helper, not app code.

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import { notesContract } from "@self-engine/storage/testing/contracts";
import { LOADER_DELAY_MS, QueryStateBlock } from "@self-engine/ui";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type FormEvent, useState } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { DataProvider, portHooks } from "../react/index.ts";
import { type FixedAnswers, fixedAnswers } from "./index.ts";

const contracts = { notes: notesContract };

const notesPort = portHooks<typeof notesContract>("notes");
const useNoteList = notesPort.query("list");
const useRenameNote = notesPort.operation("update", {
  conflicts: {
    title_taken: { text: msg`A note with this title already exists.`, field: "title" },
  },
});

type Note =
  ReturnType<typeof useNoteList> extends infer State
    ? State extends { readonly data: readonly (infer Row)[] }
      ? Row
      : never
    : never;

/** One note with a form that renames it; a conflict shows at the title field. */
function NoteRow({ note }: { readonly note: Note }) {
  const { i18n } = useLingui();
  const { run, running } = useRenameNote();
  const [title, setTitle] = useState(note.title);
  const [problem, setProblem] = useState<MessageDescriptor>();
  async function rename(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    const result = await run({ id: note.id, title });
    if (result.status === "conflict") setProblem(result.text);
  }
  return (
    <form onSubmit={(event) => void rename(event)}>
      <Group align="flex-start">
        <TextInput
          label={`Title of ${note.title}`}
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          error={problem && i18n._(problem)}
        />
        <Button type="submit" loading={running} mt="xl">
          Rename
        </Button>
      </Group>
    </form>
  );
}

function NotesView() {
  return (
    <QueryStateBlock state={useNoteList({})}>
      {(notes) => (
        <Stack aria-label="Notes" role="list">
          {notes.map((note) => (
            <div key={note.id} role="listitem">
              <NoteRow note={note} />
            </div>
          ))}
        </Stack>
      )}
    </QueryStateBlock>
  );
}

/** The View over a Port access that answers what the story fixes, built once per story. */
function NotesWith({ answers }: { readonly answers: FixedAnswers<typeof contracts> }) {
  const [access] = useState(() => fixedAnswers(contracts, answers));
  return (
    <DataProvider access={access}>
      <NotesView />
    </DataProvider>
  );
}

const meta = {
  title: "Data/Fixed Answers",
  component: NotesWith,
} satisfies Meta<typeof NotesWith>;
export default meta;
type Story = StoryObj<typeof meta>;

const T0 = "2026-11-13T09:00:00.000Z";
const GROCERIES = {
  id: "019a7c4e-0000-7000-8000-000000000001",
  createdAt: T0,
  updatedAt: T0,
  title: "Groceries",
  isPinned: false,
};
const ERRANDS = { ...GROCERIES, id: "019a7c4e-0000-7000-8000-000000000002", title: "Errands" };

/** Waits of `delay` ms, held for the story to run by hand. */
let held: ReturnType<typeof holdTimers>["held"] = new Map();

function holdWaitsOf(delay: number) {
  return () => {
    const timers = holdTimers(delay);
    held = timers.held;
    return timers.restore;
  };
}

const renameGroceriesTo = async (title: string) => {
  const field = await screen.findByRole("textbox", { name: "Title of Groceries" });
  await userEvent.clear(field);
  await userEvent.type(field, title);
  const [rename] = screen.getAllByRole("button", { name: "Rename" });
  await userEvent.click(rename!);
  return field;
};

export const ShowsTheData: Story = {
  args: { answers: { notes: { list: { data: [GROCERIES, ERRANDS] } } } },
  play: async ({ canvas }) => {
    const notes = await canvas.findAllByRole("listitem");
    await expect(notes).toHaveLength(2);
    await expect(canvas.getByRole("textbox", { name: "Title of Errands" })).toHaveValue("Errands");
  },
};

export const HoldsTheLoadingState: Story = {
  args: { answers: { notes: { list: "loading" } } },
  beforeEach: holdWaitsOf(LOADER_DELAY_MS),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("status")).toBeNull();
    for (const finish of held.values()) finish();
    // No answer ever arrives: the loading state stays as long as the story looks at it.
    await expect(await canvas.findByRole("status", { name: "Loading" })).toBeVisible();
    await expect(canvas.queryByRole("list")).toBeNull();
  },
};

export const ShowsAFailedLoad: Story = {
  args: { answers: { notes: { list: "unexpected" } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "This part could not be loaded.",
    );
    await expect(canvas.getByRole("button", { name: "Try again" })).toBeVisible();
  },
};

export const ShowsAConflictAtItsField: Story = {
  args: {
    answers: {
      notes: { list: { data: [GROCERIES, ERRANDS] }, update: { conflict: "title_taken" } },
    },
  },
  play: async () => {
    const field = await renameGroceriesTo("Errands");
    await expect(await screen.findByText("A note with this title already exists.")).toBeVisible();
    await expect(field).toHaveAccessibleDescription("A note with this title already exists.");
    // The Operation changed nothing: the list shows what it showed before.
    await expect(screen.getByRole("textbox", { name: "Title of Errands" })).toBeVisible();
  },
};

export const ShowsThatTheEntryIsGone: Story = {
  args: { answers: { notes: { list: { data: [GROCERIES] }, update: "notFound" } } },
  // A notice stays until the story looked at it.
  beforeEach: holdWaitsOf(8000),
  play: async () => {
    await renameGroceriesTo("Shopping");
    const notice = await screen.findByText("This entry no longer exists.");
    await waitFor(() => expect(notice).toBeVisible());
  },
};
