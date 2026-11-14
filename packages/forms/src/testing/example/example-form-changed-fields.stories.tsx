import { msg } from "@lingui/core/macro";
import { useState } from "react";
import { TextInput } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
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
import { CREATED, recordingPort } from "./story-port.ts";

function EditExample({
  onCancel,
  unknownIcon = false,
  unfinished = false,
}: {
  readonly onCancel: () => void;
  readonly unknownIcon?: boolean;
  readonly unfinished?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const form = useOperationForm({
    entry: exampleContract.update,
    operation: useUpdateExample(),
    draft: { ...CREATED, icon: unknownIcon ? "future-icon" : null },
    onSuccess: () => setSaved(true),
    texts: { reasons: { star_needs_color: msg`Choose a color for the star.` } },
    emptyTextFields: ["description"],
    edit: { identity: { id: CREATED.id }, tiedFields: exampleTiedFields },
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
