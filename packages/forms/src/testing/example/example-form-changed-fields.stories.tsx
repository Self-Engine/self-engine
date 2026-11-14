import { useState } from "react";
import { TextInput } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, spyOn, userEvent, waitFor, within } from "storybook/test";
import {
  ColorField,
  EditDrawerForm,
  IconField,
  TextField,
  useFieldBinding,
  useOperationForm,
} from "../../index.ts";
import { exampleContract, exampleTiedFields } from "./contract.ts";
import { useCreateExample, useUpdateExample } from "./port.ts";
import { StoryDrawer, loadStoryShell } from "./drawer-story.tsx";
import { exampleEditTexts } from "./example-form.tsx";
import { CREATED, recordingPort } from "./story-port.ts";

function EditExample({
  onCancel,
  unknownIcon = false,
  unfinished = false,
  forgottenTie = false,
}: {
  readonly onCancel: () => void;
  readonly unknownIcon?: boolean;
  readonly unfinished?: boolean;
  /** Deliberately broken: a stored circle in teal, and the edit names no tied fields. */
  readonly forgottenTie?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const form = useOperationForm({
    entry: exampleContract.update,
    operation: useUpdateExample(),
    draft: forgottenTie
      ? { ...CREATED, icon: "circle", color: "teal" }
      : { ...CREATED, icon: unknownIcon ? "future-icon" : null },
    onSuccess: () => setSaved(true),
    texts: exampleEditTexts,
    emptyTextFields: ["description"],
    edit: forgottenTie
      ? { identity: { id: CREATED.id } }
      : { identity: { id: CREATED.id }, tiedFields: exampleTiedFields },
  });
  const field = useFieldBinding(form, "description");
  const [text, setText] = useState("Paint the walls.");
  return (
    <EditDrawerForm form={form} onCancel={onCancel}>
      <TextField form={form} name="title" label="Title" />
      {unfinished ? (
        <TextInput
          label="Description"
          value={text}
          ref={field.ref}
          onBlur={field.onBlur}
          error={field.error}
          onChange={(event) => {
            setText(event.currentTarget.value);
            field.onUnfinished();
          }}
        />
      ) : (
        <TextField form={form} name="description" label="Description" />
      )}
      <IconField form={form} name="icon" label="Icon" />
      <ColorField form={form} name="color" label="Color" />
      {saved && <output>Saved</output>}
    </EditDrawerForm>
  );
}
const meta = {
  title: "Forms/Example form/Changed fields",
  loaders: [loadStoryShell, () => ({ port: recordingPort({ update: { data: CREATED } }) })],
  render: (_args, { loaded }) => (
    <DataProvider access={loaded.port.access}>
      <StoryDrawer>{({ onCancel }) => <EditExample onCancel={onCancel} />}</StoryDrawer>
    </DataProvider>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const EditSendsOnlyChangedTitle: Story = {
  play: async ({ loaded }) => {
    const canvas = within(document.body);
    await userEvent.type(await canvas.findByRole("textbox", { name: "Title" }), " again");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(loaded.port.calls).toEqual([
      { entry: "update", input: { id: "example-1", title: "Kitchen again" } },
    ]);
  },
};

export const UnchangedEditCannotSave: Story = {
  play: async ({ loaded }) => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    const title = await canvas.findByRole("textbox", { name: "Title" });
    await expect(title).toHaveValue("Kitchen");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(title, "{Enter}");
    await expect(loaded.port.calls).toEqual([]);
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
  },
};

export const ClearingOptionalTextSendsEmpty: Story = {
  play: async ({ loaded }) => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    await userEvent.clear(await canvas.findByRole("textbox", { name: "Description" }));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(loaded.port.calls).toEqual([
      { entry: "update", input: { id: "example-1", description: null } },
    ]);
  },
};

export const RestoringStoredValueRemovesTheQuestion: Story = {
  play: async () => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    const title = await canvas.findByRole("textbox", { name: "Title" });
    await userEvent.type(title, "x");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeVisible(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await userEvent.clear(title);
    await userEvent.type(title, "Kitchen");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
  },
};
export const SuccessClearsChanges: Story = {
  play: async ({ loaded }) => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    await userEvent.type(await canvas.findByRole("textbox", { name: "Title" }), " two");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(canvas.getByRole("textbox", { name: "Title" }), "{Enter}");
    await expect(loaded.port.calls).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
  },
};
export const UnknownStoredIconIsNotSent: Story = {
  ...EditSendsOnlyChangedTitle,
  render: (_args, { loaded }) => (
    <DataProvider access={loaded.port.access}>
      <StoryDrawer>{({ onCancel }) => <EditExample onCancel={onCancel} unknownIcon />}</StoryDrawer>
    </DataProvider>
  ),
};
export const TiedFieldsTravelTogether: Story = {
  render: (_args, { loaded }) => (
    <DataProvider access={loaded.port.access}>
      <StoryDrawer>{({ onCancel }) => <EditExample onCancel={onCancel} />}</StoryDrawer>
    </DataProvider>
  ),
  play: async ({ loaded }) => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    await canvas.findByRole("textbox", { name: "Title" });
    await userEvent.click(
      within(canvas.getByRole("radiogroup", { name: "Color" })).getByRole("radio", {
        name: "Teal",
      }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(loaded.port.calls).toEqual([
      {
        entry: "update",
        input: { id: "example-1", icon: null, color: "teal" },
      },
    ]);
  },
};
export const AForgottenTieIsReportedAsAProgrammingError: Story = {
  render: (_args, { loaded }) => (
    <DataProvider access={loaded.port.access}>
      <StoryDrawer>
        {({ onCancel }) => <EditExample forgottenTie onCancel={onCancel} />}
      </StoryDrawer>
    </DataProvider>
  ),
  play: async ({ loaded }) => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    await userEvent.click(await canvas.findByRole("button", { name: /^Icon/ }));
    const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
    await userEvent.click(
      within(within(dialog).getByRole("listbox", { name: "Icons" })).getByRole("option", {
        name: "Star",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose an icon" })).toBeNull(),
    );
    // Only this deliberate failure consumes the error; ordinary stories fail on console.error.
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      // The edit sends the star without the color it is tied to, so the rule fails at a field
      // that shows teal: the message there is wrong, and the missing tie is named.
      await userEvent.click(canvas.getByRole("button", { name: "Save" }));
      await expect(canvas.getByRole("radiogroup", { name: "Color" })).toHaveAccessibleDescription(
        "Choose a color for the star.",
      );
      await expect(reported).toHaveBeenCalledWith(
        'The input schema reports "color", but this edit does not submit it: name the fields its rule ties in edit.tiedFields.',
      );
      await expect(loaded.port.calls).toEqual([]);
    } finally {
      reported.mockRestore();
    }
  },
};
export const UnfinishedTextAsksBeforeClosing: Story = {
  render: (_args, { loaded }) => (
    <DataProvider access={loaded.port.access}>
      <StoryDrawer>{({ onCancel }) => <EditExample onCancel={onCancel} unfinished />}</StoryDrawer>
    </DataProvider>
  ),
  play: async ({ loaded }) => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    await userEvent.type(await canvas.findByRole("textbox", { name: "Description" }), "+");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("textbox", { name: "Description" })).toHaveAccessibleDescription(
      "Complete or clear this field.",
    );
    await expect(loaded.port.calls).toEqual([]);
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeVisible(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
  },
};

function CreateExample({ onCancel }: { readonly onCancel: () => void }) {
  const [saved, setSaved] = useState(false);
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "", description: "", icon: null, color: null },
    onSuccess: () => setSaved(true),
  });
  return (
    <EditDrawerForm form={form} onCancel={onCancel}>
      <TextField form={form} name="title" label="Title" />
      <TextField form={form} name="description" label="Description" />
      {saved && <output>Saved</output>}
    </EditDrawerForm>
  );
}
const createRender: Story["render"] = (_args, { loaded }) => (
  <DataProvider access={loaded.port.access}>
    <StoryDrawer>{({ onCancel }) => <CreateExample onCancel={onCancel} />}</StoryDrawer>
  </DataProvider>
);
export const UntouchedCreateClosesWithoutQuestion: Story = {
  render: createRender,
  play: async () => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    await canvas.findByRole("textbox", { name: "Title" });
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
    await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
  },
};
export const CreateAsksAndSendsEveryField: Story = {
  render: createRender,
  loaders: [loadStoryShell, () => ({ port: recordingPort() })],
  play: async ({ loaded }) => {
    const canvas = within(await screen.findByRole("dialog", { name: "Example" }));
    await userEvent.type(await canvas.findByRole("textbox", { name: "Title" }), "Kitchen");
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeVisible(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Description" }), "Paint the walls.");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await expect(loaded.port.calls).toEqual([
      {
        entry: "create",
        input: { title: "Kitchen", description: "Paint the walls.", icon: null, color: null },
      },
    ]);
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
  },
};
