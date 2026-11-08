import { Button, Stack, TextInput } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

/** Mantine's height of size `xs` at the 100 % font scale of the story tests. */
const COMPACT_CONTROL_HEIGHT = 30;

function Controls() {
  return (
    <Stack align="flex-start">
      <Button>Save</Button>
      <TextInput aria-label="Name" placeholder="Name" />
    </Stack>
  );
}

const meta = {
  title: "Tokens/Density",
  component: Controls,
} satisfies Meta<typeof Controls>;

export default meta;

export const Compact: StoryObj<typeof meta> = {
  globals: { density: "compact" },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Save" });
    await expect(button.getBoundingClientRect().height).toBe(COMPACT_CONTROL_HEIGHT);
    const input = canvas.getByRole("textbox", { name: "Name" });
    await expect(input.getBoundingClientRect().height).toBe(COMPACT_CONTROL_HEIGHT);
  },
};
