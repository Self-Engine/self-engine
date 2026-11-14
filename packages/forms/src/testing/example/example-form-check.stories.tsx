// The check before submit (D317, D320, D321), shown on the example form over Fixed Answers of an
// invented Contract. Each story drives the form through its fields and its button, as a user
// does, and asserts what the fields show and which call reached the Port.

import { useLingui } from "@lingui/react";
import { Button, Stack } from "@mantine/core";
import { DataProvider } from "@self-engine/data-client/react";
import { activateLanguage } from "@self-engine/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { type ExampleEntry, ExampleForm } from "./example-form.tsx";
import { CREATED, type RecordingPort, recordingPort } from "./story-port.ts";

interface Loaded {
  readonly port: RecordingPort;
  /** What the form reported to its caller. */
  readonly saved: (entry: ExampleEntry) => void;
}

/** The form's caller: it shows the entry the form reported as saved. */
function Caller({ port, saved }: Loaded) {
  const [entry, setEntry] = useState<ExampleEntry>();
  return (
    <DataProvider access={port.access}>
      <Stack>
        <ExampleForm
          onSuccess={(created) => {
            saved(created);
            setEntry(created);
          }}
        />
        {entry && <output>Saved {entry.title}</output>}
      </Stack>
    </DataProvider>
  );
}

const meta = {
  title: "Forms/Example form/Check",
  // A new Port for every render, so that a second run starts without calls.
  loaders: [(): Loaded => ({ port: recordingPort(), saved: fn() })],
  render: (_args, { loaded }) => <Caller {...(loaded as Loaded)} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const loadedOf = (loaded: unknown) => loaded as Loaded;

/** The fields and the button, found as a user finds them. */
function formIn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  return {
    title: () => canvas.getByRole("textbox", { name: "Title" }),
    description: () => canvas.getByRole("textbox", { name: "Description" }),
    save: () => userEvent.click(canvas.getByRole("button", { name: "Save" })),
    /** Every field that shows a message. */
    invalid: () => canvas.queryAllByRole("textbox").filter((field) => field.ariaInvalid === "true"),
  };
}

const REQUIRED = "This field is required.";
const TITLE_TEXT = "Give this entry a title of at most 80 characters.";

export const SavingTheEmptyFormShowsEveryMessage: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await form.save();
    // The example form maps no message: each lands at the field of the schema's name.
    await expect(form.title()).toHaveAccessibleDescription(TITLE_TEXT);
    await expect(form.description()).toHaveAccessibleDescription(REQUIRED);
    await expect(form.title()).toHaveFocus();
    await expect(loadedOf(loaded).port.calls).toEqual([]);

    // The focus goes to the first field that is still wrong, not to the first field.
    await userEvent.type(form.title(), "Kitchen");
    await form.save();
    await expect(form.invalid()).toEqual([form.description()]);
    await expect(form.description()).toHaveFocus();
    await expect(loadedOf(loaded).port.calls).toEqual([]);
  },
};

export const NothingIsReportedBeforeTheFirstSave: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    // Typing a character and taking it back leaves the title empty, and the focus leaves it.
    await userEvent.type(form.title(), "K");
    await userEvent.clear(form.title());
    await userEvent.tab();
    // A description over its limit, and the focus leaves it too.
    await userEvent.click(form.description());
    await userEvent.paste("x".repeat(501));
    await userEvent.tab();
    await expect(form.invalid()).toEqual([]);
    await expect(form.title()).not.toHaveAccessibleDescription(TITLE_TEXT);
    await expect(form.description()).not.toHaveAccessibleDescription("At most 500 characters.");
    await expect(loadedOf(loaded).port.calls).toEqual([]);
  },
};

export const AfterAFailedSaveEveryChangeIsChecked: Story = {
  play: async ({ canvasElement, loaded }) => {
    const form = formIn(canvasElement);
    await form.save();
    await expect(form.invalid()).toEqual([form.title(), form.description()]);

    // Fixing a field removes its message without another click; the other keeps its own.
    await userEvent.type(form.title(), "Kitchen");
    await expect(form.invalid()).toEqual([form.description()]);
    await userEvent.type(form.description(), "Paint the walls.");
    await expect(form.invalid()).toEqual([]);

    // Breaking a rule shows its message at once.
    await userEvent.clear(form.title());
    await expect(form.title()).toHaveAccessibleDescription(TITLE_TEXT);
    await userEvent.click(form.description());
    await userEvent.paste("x".repeat(500));
    await expect(form.description()).toHaveAccessibleDescription("At most 500 characters.");
    // Spaces alone are no title: the schema trims.
    await userEvent.type(form.title(), "   ");
    await expect(form.title()).toHaveAccessibleDescription(TITLE_TEXT);
    await expect(loadedOf(loaded).port.calls).toEqual([]);
  },
};

export const AValidFormCallsTheOperationOnce: Story = {
  play: async ({ canvasElement, loaded }) => {
    const { port, saved } = loadedOf(loaded);
    const form = formIn(canvasElement);
    await userEvent.type(form.title(), "Kitchen");
    await userEvent.type(form.description(), "Paint the walls.");
    await form.save();
    await expect(await within(canvasElement).findByText("Saved Kitchen")).toBeVisible();
    // The draft is the Operation's input as it is.
    await expect(port.calls).toEqual([
      { entry: "create", input: { title: "Kitchen", description: "Paint the walls." } },
    ]);
    await expect(saved).toHaveBeenCalledTimes(1);
    await expect(saved).toHaveBeenCalledWith(CREATED);
    await expect(form.invalid()).toEqual([]);
  },
};

/** The active translation, switched to German by a button, as the Settings switch it. */
function SwitchesToGerman() {
  const { i18n } = useLingui();
  return (
    <Button
      onClick={() => {
        void activateLanguage(i18n, "de");
      }}
      variant="default"
    >
      Deutsch
    </Button>
  );
}

export const TheMessagesFollowALanguageSwitch: Story = {
  globals: { language: "en" },
  render: (_args, { loaded }) => (
    <Stack>
      <SwitchesToGerman />
      <Caller {...loadedOf(loaded)} />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = formIn(canvasElement);
    await userEvent.click(form.title());
    await userEvent.paste("x".repeat(81));
    await form.save();
    await expect(form.title()).toHaveAccessibleDescription(TITLE_TEXT);
    await expect(form.description()).toHaveAccessibleDescription(REQUIRED);

    await userEvent.click(canvas.getByRole("button", { name: "Deutsch" }));
    await expect(
      await canvas.findByText("Gib diesem Eintrag einen Titel mit höchstens 80 Zeichen."),
    ).toBeVisible();
    await expect(form.description()).toHaveAccessibleDescription("Dieses Feld ist erforderlich.");
    // The form stayed open with what was typed, and Zod's own text appears nowhere.
    await expect(form.title()).toHaveValue("x".repeat(81));
    await expect(canvasElement).not.toHaveTextContent(/Too big|Too small|Invalid input/);
  },
};
