// An open edit form follows its entry (D324): Changing Answers change the stored entry under the
// form, as another window, an assistant or the sync would, and delete it and bring it back.
// The module-side part is what a module writes: it reads its entry with a Query, keeps the last one
// it saw, and tells the form when the entry is gone.

import { Button } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import { commitWhere } from "@self-engine/ui/story-render-counts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useDeferredValue, useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  ColorField,
  EditDrawerForm,
  IconField,
  LongTextField,
  TextField,
  useOperationForm,
} from "../../index.ts";
import { exampleTiedFields, exampleContract } from "./contract.ts";
import { loadStoryShell, StoryDrawer } from "./drawer-story.tsx";
import { fieldsDrawnDuring } from "./fields-drawn.ts";
import { type ExampleEntry, exampleEditTexts } from "./example-form.tsx";
import { useExampleEntries, useUpdateExample } from "./port.ts";
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
      {saved && <output>Saved</output>}
      {/* What the form was given, drawn in the same commit: the stories read when it changes. */}
      <span data-given-title={entry.title} hidden />
    </EditDrawerForm>
  );
}

/**
 * The Edit Drawer's content: it shows the entry the Query answers, keeps the last one it saw, and
 * tells the form when the entry is gone. A delete from inside the drawer closes it: the form keeps
 * its copy and is not told, so the message for a deleted entry does not flash while it slides out.
 */
function EditDrawer({
  id,
  onCancel,
  onDone,
  remove,
  deferred = false,
}: {
  readonly id: string;
  readonly onCancel: () => void;
  readonly onDone: () => void;
  readonly remove: () => void;
  /** Hands the form a new entry in a deferred draw, as React does with `useDeferredValue`. */
  readonly deferred?: boolean;
}) {
  const list = useExampleEntries({});
  const found =
    list.status === "loading" || list.status === "loadFailed"
      ? undefined
      : list.data.find((candidate) => candidate.id === id);
  const [last, setLast] = useState(found);
  if (found !== undefined && found !== last) setLast(found);
  const [deletedHere, setDeletedHere] = useState(false);
  const latestEntry = found ?? last;
  const deferredEntry = useDeferredValue(latestEntry);
  const entry = deferred ? deferredEntry : latestEntry;
  if (entry === undefined) return list.status === "loading" ? null : <p>Entry not found</p>;
  return (
    <EntryForm
      deleted={found === undefined && !deletedHere}
      entry={entry}
      onCancel={onCancel}
      onDelete={() => {
        setDeletedHere(true);
        remove();
        onDone();
      }}
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
          <EditDrawer
            deferred={deferred}
            id={id}
            onCancel={onCancel}
            onDone={onDone}
            remove={() => loaded.port.change(deleted())}
          />
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
  const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
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
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
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

export const DeletingFromTheDrawerShowsNoMessage: Story = {
  play: async () => {
    const { canvas } = await openForm();
    const dialog = screen.getByRole("dialog", { name: "Example" });
    let shown = false;
    const watch = new MutationObserver(() => {
      if (dialog.textContent.includes(DELETED)) shown = true;
    });
    watch.observe(document.body, { childList: true, subtree: true, characterData: true });
    await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
    watch.disconnect();
    await expect(shown).toBe(false);
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
    const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
    await userEvent.click(
      within(within(dialog).getByRole("listbox", { name: "Icons" })).getByRole("option", {
        name: "Star",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose an icon" })).toBeNull(),
    );
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
