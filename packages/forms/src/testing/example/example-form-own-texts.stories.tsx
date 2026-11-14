import { useLingui } from "@lingui/react";
import { Button, Stack } from "@mantine/core";
import { activateLanguage } from "@self-engine/i18n";
import { TextField, LongTextField, useOperationForm } from "../../index.ts";
import { exampleContract } from "./contract.ts";
import { useCreateExample } from "./port.ts";
import { DataProvider } from "@self-engine/data-client/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, spyOn, userEvent, within } from "storybook/test";
import { ExampleForm } from "./example-form.tsx";
import { recordingPort, type RecordingPort } from "./story-port.ts";

const meta = {
  title: "Forms/Example form/Own texts",
  loaders: [() => ({ port: recordingPort() })],
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded.port as RecordingPort).access}>
      <ExampleForm onSuccess={() => {}} />
    </DataProvider>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const AModuleReplacesOnlyItsOwnFieldText: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("textbox", { name: "Title" })).toHaveAccessibleDescription(
      "Give this entry a title of at most 80 characters.",
    );
    await expect(canvas.getByRole("textbox", { name: "Description" })).toHaveAccessibleDescription(
      "This field is required.",
    );
    await expect((loaded.port as RecordingPort).calls).toEqual([]);
  },
};

export const ASchemaRuleIsReportedAtItsFieldAndEitherFieldCanFixIt: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole("textbox", { name: "Title" });
    const description = canvas.getByRole("textbox", { name: "Description" });
    const save = canvas.getByRole("button", { name: "Save" });
    await userEvent.type(title, "Kitchen");
    await userEvent.type(description, "Kitchen");
    await userEvent.click(save);
    await expect(description).toHaveAccessibleDescription(
      "The description must differ from the title.",
    );
    await expect(title).not.toHaveAttribute("aria-invalid", "true");
    await expect((loaded.port as RecordingPort).calls).toEqual([]);
    await userEvent.type(title, " project");
    await expect(description).not.toHaveAttribute("aria-invalid", "true");
    await userEvent.type(description, " project");
    await expect(description).toHaveAccessibleDescription(
      "The description must differ from the title.",
    );
    await userEvent.type(description, ".");
    await expect(description).not.toHaveAttribute("aria-invalid", "true");
    await userEvent.click(save);
    await expect((loaded.port as RecordingPort).calls).toEqual([
      {
        entry: "create",
        input: {
          title: "Kitchen project",
          description: "Kitchen project.",
          icon: null,
          color: null,
        },
      },
    ]);
  },
};

/** Deliberately broken module configuration: the schema's reason has no descriptor. */
function MissingReasonForm() {
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "Kitchen", description: "Kitchen", icon: null, color: null },
  });
  return (
    <Stack>
      <TextField form={form} name="title" label="Title" />
      <LongTextField form={form} name="description" label="Description" />
      <Button onClick={() => void form.submit()}>Save</Button>
    </Stack>
  );
}

export const AMissingReasonShowsTheCatchAllAndFailsTheStoryGate: Story = {
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded.port as RecordingPort).access}>
      <MissingReasonForm />
    </DataProvider>
  ),
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    // Only this deliberate failure consumes the error; ordinary stories fail on console.error.
    const reported = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Save" }));
      await expect(
        canvas.getByRole("textbox", { name: "Description" }),
      ).toHaveAccessibleDescription("Invalid value.");
      await expect(reported).toHaveBeenCalledWith(
        'The input schema reports reason "description_matches_title", but the form gives no text for it.',
      );
      await expect((loaded.port as RecordingPort).calls).toEqual([]);
    } finally {
      reported.mockRestore();
    }
  },
};

function SwitchLanguage() {
  const { i18n } = useLingui();
  return <Button onClick={() => void activateLanguage(i18n, "de")}>Deutsch</Button>;
}

export const ModuleDescriptorsFollowALanguageSwitch: Story = {
  globals: { language: "en" },
  render: (_args, { loaded }) => (
    <DataProvider access={(loaded.port as RecordingPort).access}>
      <Stack>
        <SwitchLanguage />
        <ExampleForm onSuccess={() => {}} />
      </Stack>
    </DataProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole("textbox", { name: "Title" });
    const description = canvas.getByRole("textbox", { name: "Description" });
    await userEvent.click(title);
    await userEvent.paste("x".repeat(81));
    await userEvent.click(description);
    await userEvent.paste("x".repeat(81));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(title).toHaveAccessibleDescription(
      "Give this entry a title of at most 80 characters.",
    );
    await expect(description).toHaveAccessibleDescription(
      "The description must differ from the title.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Deutsch" }));
    await expect(
      await canvas.findByText("Gib diesem Eintrag einen Titel mit höchstens 80 Zeichen."),
    ).toBeVisible();
    await expect(description).toHaveAccessibleDescription(
      "Die Beschreibung muss sich vom Titel unterscheiden.",
    );
    await expect(title).toHaveValue("x".repeat(81));
    await expect(description).toHaveValue("x".repeat(81));
  },
};
