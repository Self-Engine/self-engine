import { Stack } from "@mantine/core";
import { entryIconSchema } from "@self-engine/icons/names";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { EntryEmojiInput } from "./index.ts";

const meta = {
  title: "UI/Entry pickers/Emoji",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The field in a form that keeps what it answers, as an edit drawer would. */
function Form({
  stored,
  answer,
}: {
  readonly stored: string | null;
  readonly answer: (value: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(stored);
  return (
    <Stack>
      <EntryEmojiInput
        onChange={(next) => {
          answer(next);
          setValue(next);
        }}
        value={value}
      />
      <output data-testid="stored">{value ?? "nothing"}</output>
    </Stack>
  );
}

const answers = fn<(value: string | null) => void>();

/** Every answer the field gave passes the strict schema, or is empty. */
async function expectStrict() {
  for (const [value] of answers.mock.calls) {
    if (value !== null) await expect(entryIconSchema.safeParse(value).success).toBe(true);
  }
}

const ERROR = "Enter exactly one emoji.";

export const OneEmojiComesBack: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    const field = canvas.getByRole("textbox", { name: "Emoji" });
    // It points to the emoji keyboard of the operating system.
    await expect(field).toHaveAccessibleDescription(/emoji keyboard/);
    await userEvent.click(field);
    await userEvent.paste("🚀");
    await expect(answers).toHaveBeenLastCalledWith("🚀");
    await expect(canvas.queryByText(ERROR)).toBeNull();
    // A joined family is one emoji too.
    await userEvent.clear(field);
    await expect(answers).toHaveBeenLastCalledWith(null);
    await userEvent.paste("👩‍👩‍👧");
    await expect(answers).toHaveBeenLastCalledWith("👩‍👩‍👧");
    await expect(canvas.getByTestId("stored")).toHaveTextContent("👩‍👩‍👧");
    await expectStrict();
  },
};

export const TwoEmojiOrAWordAreAnError: Story = {
  render: () => (
    <Stack>
      {["two emoji", "a word"].map((id) => (
        <div data-testid={id} key={id}>
          <Form answer={answers} stored={null} />
        </div>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    answers.mockClear();
    for (const [id, input] of [
      ["two emoji", "🚀🌱"],
      ["a word", "rocket"],
    ] as const) {
      const form = within(canvas.getByTestId(id));
      const field = form.getByRole("textbox", { name: "Emoji" });
      await userEvent.click(field);
      await userEvent.paste(input);
      await expect(field).toHaveAccessibleDescription(expect.stringContaining(ERROR));
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(form.getByTestId("stored")).toHaveTextContent("nothing");
    }
    // No value: the field answered nothing for either.
    await expect(answers).not.toHaveBeenCalled();
    // Correcting the input answers the emoji and takes the error away.
    const field = within(canvas.getByTestId("two emoji")).getByRole("textbox", { name: "Emoji" });
    await userEvent.type(field, "{Backspace}{Backspace}");
    await expect(answers).toHaveBeenLastCalledWith("🚀");
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
    await expectStrict();
  },
};

export const ShowsTheStoredEmojiAndNothingElse: Story = {
  render: () => (
    <Stack>
      {["🌱", "house", "a-picture-from-a-newer-version"].map((stored) => (
        <div data-testid={stored} key={stored}>
          <Form answer={answers} stored={stored} />
        </div>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    answers.mockClear();
    const fieldOf = (id: string) =>
      within(canvas.getByTestId(id)).getByRole("textbox", { name: "Emoji" });
    await expect(fieldOf("🌱")).toHaveValue("🌱");
    // An icon name belongs to the icon picker, and an unknown text shows as nothing chosen.
    await expect(fieldOf("house")).toHaveValue("");
    await expect(fieldOf("a-picture-from-a-newer-version")).toHaveValue("");
    await expect(answers).not.toHaveBeenCalled();
  },
};

/** When the icon picker chooses a picture, the emoji field of the same entry empties. */
function SharedField() {
  const [value, setValue] = useState<string | null>("🌱");
  return (
    <Stack>
      <EntryEmojiInput onChange={setValue} value={value} />
      <button onClick={() => setValue("house")}>Choose the house</button>
    </Stack>
  );
}

export const FollowsTheStoredValue: Story = {
  render: () => <SharedField />,
  play: async ({ canvas }) => {
    const field = canvas.getByRole("textbox", { name: "Emoji" });
    await expect(field).toHaveValue("🌱");
    await userEvent.click(canvas.getByRole("button", { name: "Choose the house" }));
    await expect(field).toHaveValue("");
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    const field = canvas.getByRole("textbox", { name: "Emoji" });
    await userEvent.click(field);
    await userEvent.paste("ab");
    await expect(field).toHaveAccessibleDescription(
      expect.stringContaining("Gib genau ein Emoji ein."),
    );
  },
};
