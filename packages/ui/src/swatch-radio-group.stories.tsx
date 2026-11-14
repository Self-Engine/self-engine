import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { type SwatchChoice, SwatchRadioGroup } from "./swatch-radio-group.tsx";

const meta = {
  title: "UI/Swatch radio group",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing first, as the color of an entry offers it, then two colors, one not available. */
const CHOICES: readonly SwatchChoice<string | null>[] = [
  { value: null, label: "Nothing", swatch: { color: "transparent" } },
  { value: "warm", label: "Warm", swatch: { color: "#c2410c" } },
  { value: "unavailable", label: "Unavailable", disabled: true, swatch: { color: "#4d7c0f" } },
  { value: "cool", label: "Cool", swatch: { color: "#0369a1" } },
];

const answers = fn<(value: string | null) => void>();

function Group({ stored }: { readonly stored: string | null }) {
  const [value, setValue] = useState(stored);
  return (
    <>
      <span id="swatches">Swatches</span>
      <SwatchRadioGroup
        choices={CHOICES}
        labelledBy="swatches"
        onChange={(next) => {
          answers(next);
          setValue(next);
        }}
        value={value}
      />
    </>
  );
}

export const OneTabStopAndTheArrowKeys: Story = {
  render: () => <Group stored="warm" />,
  play: async ({ canvas }) => {
    answers.mockClear();
    const group = within(canvas.getByRole("radiogroup", { name: "Swatches" }));
    await expect(group.getAllByRole("radio")).toHaveLength(4);
    await expect(group.getByRole("radio", { name: "Warm" })).toBeChecked();
    await expect(group.getByRole("radio", { name: "Unavailable" })).toBeDisabled();

    // The group is one Tab stop, on the chosen swatch.
    await userEvent.tab();
    await expect(group.getByRole("radio", { name: "Warm" })).toHaveFocus();
    await userEvent.tab();
    await expect(document.body).toHaveFocus();
    await userEvent.tab({ shift: true });

    // The arrow keys pass over a swatch that is not available and choose as they move.
    await userEvent.keyboard("{ArrowRight}");
    await expect(group.getByRole("radio", { name: "Cool" })).toBeChecked();
    await expect(answers).toHaveBeenLastCalledWith("cool");

    // A click chooses too, the empty value included.
    await userEvent.click(group.getByRole("radio", { name: "Nothing" }));
    await expect(answers).toHaveBeenLastCalledWith(null);
    await expect(group.getByRole("radio", { name: "Nothing" })).toBeChecked();
  },
};
