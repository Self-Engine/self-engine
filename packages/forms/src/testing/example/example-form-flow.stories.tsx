import { Button, Stack } from "@mantine/core";
import { EntryIconPicker } from "@self-engine/ui/entry-pickers";
import { DataProvider } from "@self-engine/data-client/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import {
  EditDrawerForm,
  OperationFormBody,
  LongTextField,
  TextField,
  useOperationForm,
} from "../../index.ts";
import { exampleContract } from "./contract.ts";
import { useCreateExample } from "./port.ts";
import { recordingPort } from "./story-port.ts";

function Flow({
  done,
  outside = false,
}: {
  readonly done: () => void;
  readonly outside?: boolean;
}) {
  const [icon, setIcon] = useState<string | null>(null);
  const form = useOperationForm({
    entry: exampleContract.create,
    operation: useCreateExample(),
    draft: { title: "Kitchen", description: "Paint the walls.", icon: null, color: null },
    onDone: done,
  });
  const fields = (
    <>
      <TextField form={form} name="title" label="Title" />
      <LongTextField form={form} name="description" label="Description" />
      <EntryIconPicker value={icon} onChange={setIcon} />
      <output>{icon}</output>
    </>
  );
  if (outside)
    return (
      <OperationFormBody form={form}>
        {fields}
        <Button type="submit">Send</Button>
      </OperationFormBody>
    );
  return (
    <EditDrawerForm form={form} onCancel={done} actions={<Button>Archive</Button>}>
      {fields}
    </EditDrawerForm>
  );
}

function Caller({ port, done, outside }: Loaded) {
  const [closed, setClosed] = useState(false);
  const [escaped, setEscaped] = useState(false);
  return (
    <DataProvider access={port.access}>
      <Stack
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) setEscaped(true);
        }}
      >
        {escaped && <output>Escape reached the Shell</output>}
        {closed ? (
          <output>Closed</output>
        ) : (
          <Flow
            outside={outside ?? false}
            done={() => {
              done();
              setClosed(true);
            }}
          />
        )}
      </Stack>
    </DataProvider>
  );
}
interface Loaded {
  readonly port: ReturnType<typeof recordingPort>;
  readonly done: () => void;
  readonly outside?: boolean;
}
const meta = {
  title: "Forms/Example form/Flow",
  loaders: [(): Loaded => ({ port: recordingPort(), done: fn() })],
  render: (_args, { loaded }) => <Caller {...(loaded as Loaded)} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SuccessClosesOnce: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /^(Save|Send)$/ })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Archive" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /^(Save|Send)$/ }));
    await expect(await canvas.findByText("Closed")).toBeVisible();
    await expect((loaded as Loaded).done).toHaveBeenCalledTimes(1);
    await expect((loaded as Loaded).port.calls).toEqual([
      {
        entry: "create",
        input: { title: "Kitchen", description: "Paint the walls.", icon: null, color: null },
      },
    ]);
  },
};

export const ConflictStaysUntilItsFieldChanges: Story = {
  loaders: [
    (): Loaded => ({ port: recordingPort({ create: { conflict: "title_taken" } }), done: fn() }),
  ],
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole("textbox", { name: "Title" });
    await userEvent.click(canvas.getByRole("button", { name: /^(Save|Send)$/ }));
    await expect(await canvas.findByText("This title is already in use.")).toBeVisible();
    await expect(title).toHaveValue("Kitchen");
    await userEvent.type(canvas.getByRole("textbox", { name: "Description" }), " Again.");
    await expect(title).toHaveAccessibleDescription("This title is already in use.");
    await userEvent.type(title, " two");
    await expect(title).not.toHaveAccessibleDescription("This title is already in use.");
    await expect((loaded as Loaded).done).not.toHaveBeenCalled();
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};

export const NotFoundCloses: Story = {
  loaders: [(): Loaded => ({ port: recordingPort({ create: "notFound" }), done: fn() })],
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^(Save|Send)$/ }));
    await expect(await canvas.findByText("Closed")).toBeVisible();
    await expect((loaded as Loaded).done).toHaveBeenCalledTimes(1);
  },
};

export const UnexpectedKeepsTheInput: Story = {
  loaders: [(): Loaded => ({ port: recordingPort({ create: "unexpected" }), done: fn() })],
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Title" }), " again");
    await userEvent.click(canvas.getByRole("button", { name: /^(Save|Send)$/ }));
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /^(Save|Send)$/ })).toBeEnabled(),
    );
    await expect(canvas.getByRole("textbox", { name: "Title" })).toHaveValue("Kitchen again");
    await expect((loaded as Loaded).done).not.toHaveBeenCalled();
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};

export const RunningLocksFieldsAndAllActions: Story = {
  loaders: [(): Loaded => ({ port: recordingPort({ create: "loading" }), done: fn() })],
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole("textbox", { name: "Title" });
    await userEvent.click(canvas.getByRole("button", { name: /^(Save|Send)$/ }));
    for (const button of canvas.getAllByRole("button")) await expect(button).toBeDisabled();
    for (const field of canvas.getAllByRole("textbox")) await expect(field).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: /^(Save|Send)$/ }));
    await userEvent.type(title, "changed{Enter}");
    await userEvent.keyboard("{Control>}{Enter}{/Control}{Meta>}{Enter}{/Meta}");
    await expect(title).toHaveValue("Kitchen");
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
    await expect((loaded as Loaded).done).not.toHaveBeenCalled();
  },
};

export const EnterInTheTitleSubmits: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Title" }), "{Enter}");
    await expect(await canvas.findByText("Closed")).toBeVisible();
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};

export const MultilineAndPickerKeepEnter: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    const description = canvas.getByRole("textbox", { name: "Description" });
    await userEvent.type(description, "{Enter}Second line");
    await expect(description).toHaveValue("Paint the walls.\nSecond line");
    await userEvent.keyboard("{Escape}");
    await expect(description).toHaveFocus();
    await expect(canvas.getByText("Escape reached the Shell")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Choose an icon" }));
    const search = dialog.getByRole("searchbox", { name: "Search icons" });
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.type(search, "circle{Enter}");
    await expect((loaded as Loaded).port.calls).toEqual([]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(canvas.getByText("circle", { selector: "output" })).toBeVisible();
    await expect((loaded as Loaded).port.calls).toEqual([]);
  },
};

export const ControlEnterSubmitsFromMultiline: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("textbox", { name: "Description" }));
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await expect(await canvas.findByText("Closed")).toBeVisible();
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};

export const CommandEnterSubmitsFromAnAction: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.click(canvas.getByRole("button", { name: "Archive" }));
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect(await canvas.findByText("Closed")).toBeVisible();
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};

export const OutsideTheDrawer: Story = {
  loaders: [(): Loaded => ({ port: recordingPort(), done: fn(), outside: true })],
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await expect(await canvas.findByText("Closed")).toBeVisible();
    await expect((loaded as Loaded).done).toHaveBeenCalledTimes(1);
  },
};

export const OutsideConflict: Story = {
  ...ConflictStaysUntilItsFieldChanges,
  loaders: [
    (): Loaded => ({
      port: recordingPort({ create: { conflict: "title_taken" } }),
      done: fn(),
      outside: true,
    }),
  ],
};
export const OutsideNotFound: Story = {
  ...NotFoundCloses,
  loaders: [
    (): Loaded => ({ port: recordingPort({ create: "notFound" }), done: fn(), outside: true }),
  ],
};
export const OutsideUnexpected: Story = {
  ...UnexpectedKeepsTheInput,
  loaders: [
    (): Loaded => ({ port: recordingPort({ create: "unexpected" }), done: fn(), outside: true }),
  ],
};
export const OutsideRunning: Story = {
  ...RunningLocksFieldsAndAllActions,
  loaders: [
    (): Loaded => ({ port: recordingPort({ create: "loading" }), done: fn(), outside: true }),
  ],
};
export const GermanActions: Story = {
  globals: { language: "de" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Speichern" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Abbrechen" })).toBeVisible();
  },
};
export const CancelReportsTheExit: Story = {
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(await canvas.findByText("Closed")).toBeVisible();
    await expect((loaded as Loaded).port.calls).toEqual([]);
  },
};

export const SavingFromAnOpenPickerLocksItToo: Story = {
  loaders: [(): Loaded => ({ port: recordingPort({ create: "loading" }), done: fn() })],
  play: async ({ canvasElement, loaded }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Choose an icon" }));
    const search = dialog.getByRole("searchbox", { name: "Search icons" });
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.type(search, "circle");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await expect(canvas.getByRole("button", { name: /^(Save|Send)$/ })).toBeDisabled();
    await userEvent.click(dialog.getByRole("option", { name: "Circle" }));
    await expect(canvas.queryByText("circle", { selector: "output" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}{Meta>}{Enter}{/Meta}");
    await expect((loaded as Loaded).port.calls).toHaveLength(1);
  },
};
