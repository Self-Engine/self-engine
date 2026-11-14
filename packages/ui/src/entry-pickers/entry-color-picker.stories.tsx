import { Stack } from "@mantine/core";
import { COLOR_SET_NAMES, type ColorSetName, colorSetNameSchema } from "@self-engine/theme/names";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { EntryColorPicker } from "./index.ts";

const meta = {
  title: "UI/Entry pickers/Color",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each Color Set under the name the picker gives it, around the color wheel. */
const NAMES: Readonly<Record<ColorSetName, string>> = {
  red: "Red",
  pink: "Pink",
  grape: "Grape",
  violet: "Violet",
  indigo: "Indigo",
  blue: "Blue",
  cyan: "Cyan",
  teal: "Teal",
  green: "Green",
  lime: "Lime",
  yellow: "Yellow",
  orange: "Orange",
};

/** "No color" first, then the twelve, as the picker lists them. */
const CHOICES = [
  [null, "No color"],
  ...COLOR_SET_NAMES.map((name) => [name, NAMES[name]] as const),
] as const;

/** The picker in a form that keeps what it answers, as an edit drawer would. */
function Form({
  stored,
  answer,
}: {
  readonly stored: string | null;
  readonly answer: (value: ColorSetName | null) => void;
}) {
  const [value, setValue] = useState<string | null>(stored);
  return (
    <Stack>
      <EntryColorPicker
        onChange={(next) => {
          answer(next);
          setValue(next);
        }}
        value={value}
      />
    </Stack>
  );
}

const answers = fn<(value: ColorSetName | null) => void>();

/** Every answer the picker gave passes the strict schema, or is empty. */
async function expectStrict() {
  for (const [value] of answers.mock.calls) {
    if (value !== null) await expect(colorSetNameSchema.safeParse(value).success).toBe(true);
  }
}

export const PicksEachColorWithTheMouse: Story = {
  render: () => <Form answer={answers} stored="teal" />,
  play: async ({ canvas }) => {
    answers.mockClear();
    const group = canvas.getByRole("radiogroup", { name: "Color" });
    const radios = within(group).getAllByRole("radio");
    await expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual(
      CHOICES.map(([, name]) => name),
    );
    // The current color is marked.
    await expect(within(group).getByRole("radio", { name: "Teal" })).toBeChecked();
    for (const [value, name] of [...CHOICES.slice(1), CHOICES[0]]) {
      await userEvent.click(within(group).getByRole("radio", { name }));
      await expect(answers).toHaveBeenLastCalledWith(value);
      await expect(within(group).getByRole("radio", { name })).toBeChecked();
      await expect(within(group).getAllByRole("radio", { checked: true })).toHaveLength(1);
    }
    await expectStrict();
  },
};

export const PicksEachColorWithTheKeyboard: Story = {
  render: () => <Form answer={answers} stored={null} />,
  play: async ({ canvas }) => {
    answers.mockClear();
    const group = canvas.getByRole("radiogroup", { name: "Color" });
    // One Tab stop for the whole group: the chosen color, here "No color".
    await userEvent.tab();
    await expect(within(group).getByRole("radio", { name: "No color" })).toHaveFocus();
    for (const [value, name] of CHOICES.slice(1)) {
      await userEvent.keyboard("{ArrowRight}");
      await expect(within(group).getByRole("radio", { name })).toHaveFocus();
      await expect(answers).toHaveBeenLastCalledWith(value);
    }
    // Past the last color the arrow wraps around to "No color".
    await userEvent.keyboard("{ArrowRight}");
    await expect(answers).toHaveBeenLastCalledWith(null);
    await expect(within(group).getByRole("radio", { name: "No color" })).toBeChecked();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(answers).toHaveBeenLastCalledWith("orange");
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(within(group).getByRole("radio", { name: "Orange" })).toHaveFocus();
    await expectStrict();
  },
};

export const AnUnknownColorShowsAsNothingChosen: Story = {
  render: () => (
    <Stack>
      {["gray", "#ff0000", "a-color-from-a-newer-version"].map((stored) => (
        <div data-testid={stored} key={stored}>
          <Form answer={answers} stored={stored} />
        </div>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    answers.mockClear();
    for (const stored of ["gray", "#ff0000", "a-color-from-a-newer-version"]) {
      const picker = within(canvas.getByTestId(stored));
      await expect(picker.getByRole("radio", { name: "No color" })).toBeChecked();
      await expect(picker.getAllByRole("radio", { checked: true })).toHaveLength(1);
    }
    // Nothing is answered, so the stored text stays as it is until the user chooses.
    await expect(answers).not.toHaveBeenCalled();
  },
};

export const InGerman: Story = {
  globals: { language: "de" },
  render: () => <Form answer={answers} stored="yellow" />,
  play: async ({ canvas }) => {
    const group = canvas.getByRole("radiogroup", { name: "Farbe" });
    await expect(within(group).getByRole("radio", { name: "Gelb" })).toBeChecked();
    await expect(within(group).getByRole("radio", { name: "Keine Farbe" })).not.toBeChecked();
  },
};
