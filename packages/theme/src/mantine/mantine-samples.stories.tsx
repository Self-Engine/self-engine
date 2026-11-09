import {
  Button,
  Card as MantineCard,
  Menu as MantineMenu,
  Select as MantineSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor } from "storybook/test";

const meta = {
  title: "Mantine/Samples",
} satisfies Meta;

export default meta;

export const Card: StoryObj<typeof meta> = {
  render: () => (
    <MantineCard padding="md" withBorder>
      <Text fw={600}>Card</Text>
      <Text c="dimmed">Dimmed text on a card</Text>
    </MantineCard>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Dimmed text on a card")).toBeVisible();
  },
};

export const Input: StoryObj<typeof meta> = {
  render: () => (
    <Stack>
      <TextInput label="Input" placeholder="Placeholder" />
      <TextInput label="Filled input" placeholder="Placeholder" variant="filled" />
      <TextInput disabled label="Disabled input" placeholder="Placeholder" />
    </Stack>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Disabled input" })).toBeDisabled();
    const input = canvas.getByRole("textbox", { name: "Input" });
    await userEvent.type(input, "Hello");
    await expect(input).toHaveValue("Hello");
  },
};

export const Select: StoryObj<typeof meta> = {
  render: () => (
    <MantineSelect data={["One", "Two", "Three"]} label="Select" placeholder="Pick one" />
  ),
  play: async ({ canvas }) => {
    const select = canvas.getByRole("combobox", { name: "Select" });
    await userEvent.click(select);
    // Floating layers render into a portal, outside the story's own canvas.
    await userEvent.click(await screen.findByRole("option", { name: "Two" }));
    await expect(select).toHaveValue("Two");
  },
};

export const Menu: StoryObj<typeof meta> = {
  render: () => (
    <MantineMenu>
      <MantineMenu.Target>
        <Button variant="default">Menu</Button>
      </MantineMenu.Target>
      <MantineMenu.Dropdown>
        <MantineMenu.Label>Label</MantineMenu.Label>
        <MantineMenu.Item>First item</MantineMenu.Item>
        <MantineMenu.Item>Second item</MantineMenu.Item>
      </MantineMenu.Dropdown>
    </MantineMenu>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Menu" }));
    const item = await screen.findByRole("menuitem", { name: "First item" });
    // The item exists before its opening transition has made it visible.
    await waitFor(() => expect(item).toBeVisible());
  },
};
