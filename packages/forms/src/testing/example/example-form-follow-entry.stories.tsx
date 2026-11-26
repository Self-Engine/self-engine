// An open edit form follows its entry (D324): Changing Answers change the stored entry under the
// form, as another window, an assistant or the sync would, and delete it and bring it back.
// The module reads its entry with a Query and uses the shared hook to follow it through deletion.

import { Button } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import { calendarDaySchema, wallClockTimeSchema } from "@self-engine/time";
import { ErrorState } from "@self-engine/ui";
import { clearNotices } from "@self-engine/ui/story-notices";
import { afterTheCommitsNowDue, commitWhere } from "@self-engine/ui/story-render-counts";
import { holdTimers } from "@self-engine/ui/story-timers";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useDeferredValue, useState } from "react";
import { closed, settled } from "@self-engine/ui/story-surfaces";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  CalendarDayField,
  ColorField,
  EditDrawerForm,
  IconField,
  LongTextField,
  TextField,
  useLeavingEntry,
  useOperationForm,
  WallClockTimeField,
} from "../../index.ts";
import { exampleTiedFields, exampleContract } from "./contract.ts";
import { loadStoryShell, StoryDrawer } from "./drawer-story.tsx";
import { fieldsDrawnDuring } from "./fields-drawn.ts";
import { EXAMPLE_TODAY, type ExampleEntry, exampleEditTexts } from "./example-form.tsx";
import { useDeleteExample, useExampleEntries, useUpdateExample } from "./port.ts";
import { CREATED, type ChangingPort, changingPort } from "./story-port.ts";

const STORED: ExampleEntry = { ...CREATED };

/** The list the Port answers: the stored entry with `changes`, or without it once deleted. */
const listOf = (entries: readonly ExampleEntry[]) => ({
  list: { data: entries.map((entry) => ({ ...entry })) },
  update: { data: STORED },
});
const storedAs = (changes: Partial<ExampleEntry>) => listOf([{ ...STORED, ...changes }]);
const deleted = () => listOf([]);

interface EntryFormProps {
  readonly entry: ExampleEntry;
  readonly deleted: boolean;
  readonly onCancel: () => void;
  readonly onDelete: () => void;
}

/** The form of the Edit Drawer, written as a module writes it. */
function EntryForm({ entry, deleted: gone, onCancel, onDelete }: EntryFormProps) {
  const [saved, setSaved] = useState(false);
  const form = useOperationForm({
    entry: exampleContract.update,
    operation: useUpdateExample(),
    draft: entry,
    edit: { identity: { id: entry.id }, tiedFields: exampleTiedFields, deleted: gone },
    emptyTextFields: ["description"],
    texts: exampleEditTexts,
    onSuccess: () => setSaved(true),
  });
  return (
    <EditDrawerForm
      actions={
        <Button onClick={onDelete} variant="subtle">
          Delete
        </Button>
      }
      form={form}
      onCancel={onCancel}
    >
      <TextField form={form} label="Title" name="title" />
      <LongTextField form={form} label="Description" name="description" />
      <IconField form={form} label="Icon" name="icon" />
      <ColorField form={form} label="Color" name="color" />
      <CalendarDayField
        firstDayOfWeek="monday"
        form={form}
        label="Day"
        name="day"
        today={EXAMPLE_TODAY}
      />
      <WallClockTimeField form={form} label="Start" name="start" />
      {saved && <output>Saved</output>}
      {/* What the form was given, drawn in the same commit: the stories read when it changes. */}
      <span data-given-title={entry.title} hidden />
    </EditDrawerForm>
  );
}

/** The Edit Drawer's content follows the Query and waits for Delete before closing. */
function EditDrawer({
  id,
  onCancel,
  onDone,
  deferred = false,
}: {
  readonly id: string;
  readonly onCancel: () => void;
  readonly onDone: () => void;
  /** Hands the form a new entry in a deferred draw, as React does with `useDeferredValue`. */
  readonly deferred?: boolean;
}) {
  const list = useExampleEntries({});
  const found =
    list.status === "loading" || list.status === "loadFailed"
      ? undefined
      : list.data.find((candidate) => candidate.id === id);
  const remove = useDeleteExample();
  const { entry: latestEntry, deleted, leave } = useLeavingEntry(found, onDone);
  const deferredEntry = useDeferredValue(latestEntry);
  const entry = deferred ? deferredEntry : latestEntry;
  if (entry === undefined)
    return list.status === "loading" ? null : (
      <ErrorState
        title="Entry not found"
        action={
          <Button onClick={onDone} variant="default">
            Close
          </Button>
        }
      />
    );
  return (
    <EntryForm
      deleted={deleted}
      entry={entry}
      onCancel={onCancel}
      onDelete={() =>
        void leave(async () => {
          const { status } = await remove.run({ id: entry.id });
          return status === "success" || status === "notFound";
        })
      }
    />
  );
}

/** The Edit Drawer of the stories; `deferred` hands the form each new entry in a deferred draw. */
const drawerOf =
  (deferred: boolean): NonNullable<Meta["render"]> =>
  (_args, { loaded }) => (
    <DataProvider access={loaded.port.access}>
      <StoryDrawer>
        {({ id, onCancel, onDone }) => (
          <EditDrawer deferred={deferred} id={id} onCancel={onCancel} onDone={onDone} />
        )}
      </StoryDrawer>
    </DataProvider>
  );

const meta = {
  title: "Forms/Example form/Follow entry",
  loaders: [loadStoryShell, () => ({ port: changingPort(storedAs({})) })],
  render: drawerOf(false),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function textInput(element: HTMLElement): HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element;
  throw new Error("Not a text input");
}

/** The open form, once it shows the stored entry. */
async function openForm() {
  const canvas = within(await settled(screen.findByRole("dialog", { name: "Example" })));
  const title = textInput(await canvas.findByRole("textbox", { name: "Title" }));
  const description = textInput(canvas.getByRole("textbox", { name: "Description" }));
  const save = canvas.getByRole("button", { name: /^(Save|Speichern)$/ });
  return { canvas, title, description, save };
}

const DELETED = "This entry was deleted";

export const AnUntouchedFieldShowsTheNewValue: Story = {
  play: async ({ loaded }) => {
    const { canvas, title, description, save } = await openForm();
    loaded.port.change(storedAs({ title: "Kitchen and hall", color: "teal" }));
    await waitFor(() => expect(title).toHaveValue("Kitchen and hall"));
    await expect(description).toHaveValue("Paint the walls.");
    await expect(
      within(canvas.getByRole("radiogroup", { name: "Color" })).getByRole("radio", {
        name: "Teal",
      }),
    ).toBeChecked();
    await expect(save).toBeDisabled();
    await userEvent.type(title, "{Enter}");
    await expect(loaded.port.calls).toEqual([]);
  },
};

export const AnUntouchedDayAndTimeShowTheNewValue: Story = {
  play: async ({ loaded }) => {
    const { canvas, save } = await openForm();
    loaded.port.change(
      storedAs({
        day: calendarDaySchema.parse("2026-11-05"),
        start: wallClockTimeSchema.parse("14:30"),
      }),
    );
    // Each picker is drawn anew with the value, so its inputs are found again.
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "Day" })).toHaveValue("11/05/2026"),
    );
    await waitFor(() =>
      expect(canvas.getByRole("spinbutton", { name: "Start" })).toHaveValue("02"),
    );
    await expect(canvas.getByRole("spinbutton", { name: "Minutes" })).toHaveValue("30");
    await expect(canvas.getByRole("textbox", { name: "AM or PM" })).toHaveValue("PM");
    await expect(save).toBeDisabled();
  },
};

export const AHalfTypedDayKeepsItsTextWhenTheEntryChanges: Story = {
  play: async ({ loaded }) => {
    const { canvas, save } = await openForm();
    await userEvent.type(canvas.getByRole("textbox", { name: "Day" }), "11/5");
    // Text that is no day yet is a change.
    await expect(save).toBeEnabled();
    loaded.port.change(
      storedAs({ title: "Kitchen and hall", day: calendarDaySchema.parse("2026-12-24") }),
    );
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "Title" })).toHaveValue("Kitchen and hall"),
    );
    await expect(canvas.getByRole("textbox", { name: "Day" })).toHaveValue("11/5");
    await userEvent.click(save);
    await expect(await canvas.findByText("Complete or clear this field.")).toBeVisible();
    await expect(loaded.port.calls).toEqual([]);
  },
};

export const AChangedFieldKeepsItsTextAndIsSentAlone: Story = {
  play: async ({ loaded }) => {
    const { canvas, title, description, save } = await openForm();
    await userEvent.type(description, " Twice.");
    loaded.port.change(storedAs({ title: "Kitchen and hall", description: "Paint the ceiling." }));
    await waitFor(() => expect(title).toHaveValue("Kitchen and hall"));
    await expect(description).toHaveValue("Paint the walls. Twice.");
    await userEvent.click(save);
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(loaded.port.calls).toEqual([
      { entry: "update", input: { id: "example-1", description: "Paint the walls. Twice." } },
    ]);
  },
};

export const AStoredValueEqualToTheTypedOneIsNoChange: Story = {
  play: async ({ loaded }) => {
    const { canvas, title, save } = await openForm();
    await userEvent.type(title, " and hall");
    await expect(save).toBeEnabled();
    loaded.port.change(storedAs({ title: "Kitchen and hall" }));
    await waitFor(() => expect(save).toBeDisabled());
    await expect(title).toHaveValue("Kitchen and hall");
    // Nothing left to lose: Cancel closes without asking.
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await closed(() => screen.queryByRole("dialog", { name: "Example" }));
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
  },
};

export const TheFieldTypedInKeepsItsCaretAndText: Story = {
  play: async ({ loaded }) => {
    const { canvas, title, description } = await openForm();
    await userEvent.type(title, " and hall");
    // The caret stands after "Kitchen", in the middle of the text.
    await userEvent.keyboard("{ArrowLeft>9/}");
    loaded.port.change(
      storedAs({ title: "Bathroom", description: "Tile the floor.", icon: "circle" }),
    );
    await waitFor(() => expect(description).toHaveValue("Tile the floor."));
    await expect(canvas.getByRole("button", { name: /^Icon/ })).toHaveAccessibleName(/Circle/);
    await expect(title).toHaveFocus();
    await expect(title).toHaveValue("Kitchen and hall");
    await userEvent.keyboard(",");
    await expect(title).toHaveValue("Kitchen, and hall");
  },
};

export const NoFrameShowsTheOldValue: Story = {
  render: drawerOf(true),
  play: async ({ loaded }) => {
    const { title } = await openForm();
    const given = screen
      .getByRole("dialog", { name: "Example" })
      .querySelector<HTMLElement>("[data-given-title]");
    loaded.port.change(storedAs({ title: "Kitchen and hall" }));
    // Resumes in the task of the commit that hands the form the new entry, before any paint.
    await commitWhere(() => given?.dataset["givenTitle"] === "Kitchen and hall");
    const shown = title.value;
    await expect(shown).toBe("Kitchen and hall");
  },
};

export const AnUntouchedFieldWithTheCaretKeepsItWhenItFollows: Story = {
  play: async ({ loaded }) => {
    const { description } = await openForm();
    await userEvent.click(description);
    // The caret stands after "Paint".
    description.setSelectionRange(5, 5);
    loaded.port.change(storedAs({ description: "Paint the ceiling." }));
    await waitFor(() => expect(description).toHaveValue("Paint the ceiling."));
    await expect(description).toHaveFocus();
    await userEvent.keyboard("!");
    await expect(description).toHaveValue("Paint! the ceiling.");
  },
};

const FIELDS = ["TextField", "LongTextField", "IconField", "ColorField"] as const;

/** How often each field drew while the stored entry changed to `changes`. */
const fieldsDrawnWhenStoredAs = (
  port: ChangingPort,
  changes: Partial<ExampleEntry>,
  shown: () => void,
) =>
  fieldsDrawnDuring(FIELDS, async () => {
    port.change(storedAs(changes));
    await waitFor(shown);
  });

export const AChangedStoredValueRedrawsOnlyItsField: Story = {
  play: async ({ loaded }) => {
    const { canvas, title } = await openForm();
    const color = within(canvas.getByRole("radiogroup", { name: "Color" }));
    // A text field takes its new value without drawing again; a picker draws once.
    await expect(
      await fieldsDrawnWhenStoredAs(loaded.port, { title: "Kitchen and hall" }, () =>
        expect(title).toHaveValue("Kitchen and hall"),
      ),
    ).toEqual({ TextField: 0, LongTextField: 0, IconField: 0, ColorField: 0 });
    await expect(
      await fieldsDrawnWhenStoredAs(loaded.port, { title: "Kitchen and hall", color: "teal" }, () =>
        expect(color.getByRole("radio", { name: "Teal" })).toBeChecked(),
      ),
    ).toEqual({ TextField: 0, LongTextField: 0, IconField: 0, ColorField: 1 });
  },
};

export const ADeletedEntryKeepsTheTextAndCannotBeSaved: Story = {
  play: async ({ loaded }) => {
    const { canvas, title, save } = await openForm();
    await userEvent.type(title, " and hall");
    loaded.port.change(deleted());
    await expect(await canvas.findByRole("alert")).toHaveTextContent(DELETED);
    await expect(title).toHaveValue("Kitchen and hall");
    await expect(title).toBeEnabled();
    // The text can still be selected and copied.
    title.select();
    const copied = await userEvent.copy();
    await expect(copied?.getData("text/plain")).toBe("Kitchen and hall");
    await expect(save).toBeDisabled();
    await userEvent.click(title);
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect(loaded.port.calls).toEqual([]);
  },
};

export const AnUndoneDeleteMakesTheFormNormalAgain: Story = {
  play: async ({ loaded }) => {
    const { canvas, title, description, save } = await openForm();
    await userEvent.type(title, " and hall");
    loaded.port.change(deleted());
    await canvas.findByRole("alert");
    // The undo brings the entry back as it was stored.
    loaded.port.change(storedAs({ description: "Paint the ceiling." }));
    await waitFor(() => expect(canvas.queryByRole("alert")).toBeNull());
    await expect(title).toHaveValue("Kitchen and hall");
    await expect(description).toHaveValue("Paint the ceiling.");
    await expect(save).toBeEnabled();
    await userEvent.click(save);
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(loaded.port.calls).toEqual([
      { entry: "update", input: { id: "example-1", title: "Kitchen and hall" } },
    ]);
  },
};

export const AnUndoneDeleteWithoutChangesLeavesSaveDisabled: Story = {
  play: async ({ loaded }) => {
    const { canvas, save } = await openForm();
    loaded.port.change(deleted());
    await canvas.findByRole("alert");
    loaded.port.change(storedAs({}));
    await waitFor(() => expect(canvas.queryByRole("alert")).toBeNull());
    await expect(save).toBeDisabled();
  },
};

const DELETE_CALL = { entry: "delete", input: { id: STORED.id } };
const openDialog = () => screen.queryByRole("dialog", { name: "Example" });

/** Lets the Query lose the entry before the delete answers, as a Table Change can arrive first. */
function portWithHeldDelete(answer: { readonly data: ExampleEntry } | "notFound") {
  const port = changingPort({ ...storedAs({}), delete: answer });
  const { promise, resolve } = Promise.withResolvers<void>();
  return {
    ...port,
    access: {
      ...port.access,
      async call(...args: Parameters<ChangingPort["access"]["call"]>) {
        if (args[1] === "delete") await promise;
        return port.access.call(...args);
      },
    },
    loseEntry: () => port.change({ ...deleted(), delete: answer }),
    finishDelete: () => resolve(),
  };
}

const aDeleteThatClosesWithoutWarning = (
  answer: Parameters<typeof portWithHeldDelete>[0],
  twice = false,
): Story => ({
  loaders: [() => ({ port: portWithHeldDelete(answer) })],
  play: async ({ loaded }) => {
    const port: ReturnType<typeof portWithHeldDelete> = loaded.port;
    const { canvas, title } = await openForm();
    const dialog = screen.getByRole("dialog", { name: "Example" });
    let shown = false;
    const watch = new MutationObserver(() => {
      if (dialog.textContent.includes(DELETED) || dialog.textContent.includes("Entry not found"))
        shown = true;
    });
    watch.observe(dialog, { childList: true, subtree: true, characterData: true });
    try {
      const remove = canvas.getByRole("button", { name: "Delete" });
      if (twice) {
        // Both activations reach the handler before React can draw again.
        remove.click();
        remove.click();
      } else {
        await userEvent.click(remove);
      }
      port.loseEntry();
      await afterTheCommitsNowDue();
      await expect(dialog).toBeVisible();
      await expect(title).toHaveValue(STORED.title);
      port.finishDelete();
      await closed(openDialog);
      await expect(shown).toBe(false);
      await expect(port.calls).toEqual([DELETE_CALL]);
    } finally {
      port.finishDelete();
      watch.disconnect();
    }
  },
});

export const DeletingFromTheDrawerShowsNoMessage = aDeleteThatClosesWithoutWarning({
  data: STORED,
});
export const DeletingAnEntryAlreadyGoneClosesWithoutWarning =
  aDeleteThatClosesWithoutWarning("notFound");
export const TwoActivationsAtOnceDeleteOnce = aDeleteThatClosesWithoutWarning(
  { data: STORED },
  true,
);

export const AFailedDeleteKeepsTheDrawerOpenWithWhatWasTyped: Story = {
  beforeEach: () => {
    clearNotices();
    return holdTimers(8000).restore;
  },
  loaders: [() => ({ port: changingPort({ ...storedAs({}), delete: "unexpected" }) })],
  play: async ({ loaded }) => {
    const { canvas, title, save } = await openForm();
    await userEvent.type(title, " and hall");
    await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.getByText("Something went wrong, and the change was not saved.")).toBeVisible(),
    );
    await expect(openDialog()).toBeVisible();
    await expect(title).toHaveValue("Kitchen and hall");
    await expect(save).toBeEnabled();
    await expect(loaded.port.calls).toEqual([DELETE_CALL]);
  },
};

export const AnUnknownEntryOffersOnlyToClose: Story = {
  loaders: [() => ({ port: changingPort(deleted()) })],
  play: async () => {
    const canvas = within(await settled(screen.findByRole("dialog", { name: "Example" })));
    const failure = within(await canvas.findByRole("alert"));
    await expect(failure.getByText("Entry not found")).toBeVisible();
    await expect(failure.getAllByRole("button")).toHaveLength(1);
    await expect(canvas.queryByRole("textbox")).toBeNull();
    await userEvent.click(failure.getByRole("button", { name: "Close" }));
    await closed(openDialog);
  },
};

export const TheMessageInGerman: Story = {
  globals: { language: "de" },
  play: async ({ loaded }) => {
    const { canvas } = await openForm();
    loaded.port.change(deleted());
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Dieser Eintrag wurde gelöscht",
    );
    await expect(canvas.getByRole("button", { name: "Speichern" })).toBeDisabled();
    await expect(loaded.port.calls).toEqual([]);
  },
};

export const AStarWithoutAColorIsReportedAtTheColor: Story = {
  play: async ({ loaded }) => {
    const { canvas, save } = await openForm();
    const color = canvas.getByRole("radiogroup", { name: "Color" });
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = await settled(screen.findByRole("dialog", { name: "Choose an icon" }));
    await userEvent.click(
      within(within(dialog).getByRole("listbox", { name: "Icons" })).getByRole("option", {
        name: "Star",
      }),
    );
    await closed(() => screen.queryByRole("dialog", { name: "Choose an icon" }));
    // The rule ties the color to the icon: the stored "no color" is checked and sent with it.
    await userEvent.click(save);
    await expect(color).toHaveAccessibleDescription("Choose a color for the star.");
    await expect(loaded.port.calls).toEqual([]);

    await userEvent.click(within(color).getByRole("radio", { name: "Teal" }));
    await expect(color).not.toHaveAccessibleDescription("Choose a color for the star.");
    await userEvent.click(save);
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(loaded.port.calls).toEqual([
      { entry: "update", input: { id: "example-1", icon: "star", color: "teal" } },
    ]);
  },
};
